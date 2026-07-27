import mongoose from 'mongoose';
import { scoreSkills } from '../agents/scoring.agent';
import { parseAndSaveAnalysis, computeMatchScoreFromRaw, parseSkillScoresFromRaw } from '../dal/cvAnalysis.dal';
import { ICvAnalysis } from '../models/cvAnalysis.model';
import { validateSkillArray } from '../utils/validateSkills';
import { ValidationError } from '../errors';
import {
  logFallbackScoring,
  logLlmScoringOk,
  logLlmScoringRawUnnormalized,
  logLlmScoringUniformReplaced,
} from '../utils/logger';

const MIN_CV_TEXT_LENGTH = 50;
const SCORE_MIN = 0;
const SCORE_MAX = 10;

/** Keyword overlap 0-10; no keyword match returns 0, full match returns 10. */
function overlapScoreForSkill(skill: string, cvText: string): number {
  const cv = cvText.toLowerCase();
  const tokens = skill
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) {
    return SCORE_MIN;
  }
  const hits = tokens.filter((t) => cv.includes(t)).length;
  const ratio = hits / tokens.length;
  const score = Math.round(SCORE_MIN + ratio * (SCORE_MAX - SCORE_MIN));
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

function calcMatchScoreFromSkillScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Fast keyword-only scoring for background saved-CV comparisons (no LLM, no persist). */
export function scoreCvKeywordOnly(cvText: string, skills: string[]): number {
  const json = buildKeywordFallbackJson(skills, cvText);
  const parsed = JSON.parse(json) as { skills: Array<{ score: number }> };
  return calcMatchScoreFromSkillScores(parsed.skills.map((s) => s.score));
}

/** Keyword-overlap fallback used when LLM is unavailable or returns uniform scores. */
function buildKeywordFallbackJson(skills: string[], cvText: string): string {
  // Empty evidence/missing keep the shape consistent; the UI hides the
  // deep-dive panel rather than showing fabricated analysis text.
  const scored = skills.map((skill) => ({
    skill,
    score: overlapScoreForSkill(skill, cvText),
    evidence: '',
    missing: '',
  }));
  return JSON.stringify({ skills: scored });
}

function detectUniformScores(scores: number[]): boolean {
  return scores.length > 0 && scores.every((n) => n === scores[0]);
}

/**
 * Map LLM JSON to our skills in order; fill gaps with overlap scores.
 * If the model returns the same score for every skill, use keyword scores instead.
 */
function parseScoringJson(raw: string): { skills?: unknown } {
  try {
    return JSON.parse(raw) as { skills?: unknown };
  } catch {
    // Models occasionally wrap the JSON in a fence or a prose preamble;
    // salvage the embedded object before giving up on the whole response.
    const embedded = raw.match(/[{[][\s\S]*[}\]]/);
    if (embedded) {
      return JSON.parse(embedded[0]) as { skills?: unknown };
    }
    throw new Error('LLM scoring response is not valid JSON');
  }
}

interface PoolEntry {
  score: number;
  evidence: string;
  missing: string;
}

function normalizeLlmScoringJson(
  raw: string,
  expectedSkills: string[],
  cvText: string
): { json: string; uniformReplacedWithKeywords: boolean } {
  const parsed = parseScoringJson(raw);
  if (!Array.isArray(parsed.skills)) {
    throw new Error('Invalid LLM scoring shape');
  }

  const pool = new Map<string, PoolEntry>();
  for (const row of parsed.skills) {
    if (
      row &&
      typeof row === 'object' &&
      'skill' in row &&
      'score' in row &&
      typeof (row as { skill: unknown }).skill === 'string' &&
      typeof (row as { score: unknown }).score === 'number'
    ) {
      const entry = row as { skill: string; score: number; evidence?: unknown; missing?: unknown };
      pool.set(entry.skill.trim().toLowerCase(), {
        score: entry.score,
        evidence: typeof entry.evidence === 'string' ? entry.evidence.trim() : '',
        missing: typeof entry.missing === 'string' ? entry.missing.trim() : '',
      });
    }
  }

  const aligned = expectedSkills.map((skill) => {
    const k = skill.trim().toLowerCase();
    let entry = pool.get(k);
    if (entry === undefined) {
      for (const [name, e] of pool) {
        if (name.includes(k) || k.includes(name)) {
          entry = e;
          break;
        }
      }
    }
    if (entry === undefined) {
      entry = { score: overlapScoreForSkill(skill, cvText), evidence: '', missing: '' };
    }
    const clamped = Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(entry.score)));
    return { skill, score: clamped, evidence: entry.evidence, missing: entry.missing };
  });

  const values = aligned.map((a) => a.score);
  if (detectUniformScores(values)) {
    return {
      json: buildKeywordFallbackJson(expectedSkills, cvText),
      uniformReplacedWithKeywords: true,
    };
  }

  return {
    json: JSON.stringify({ skills: aligned }),
    uniformReplacedWithKeywords: false,
  };
}

export interface ScoreRequest {
  userId?: string;
  jobId: string;
  jobTitle: string;
  cvText: string;
  skills: unknown;
  cvFileName?: string;
  expectedSkillCount?: number;
  cvOnlyMode?: boolean;
  keywordOnly?: boolean;
}

export interface ScoreMatchResult {
  matchScore: number;
  isEstimated: boolean;
  skills: Array<{ name: string; score: number; evidence?: string; missing?: string }>;
  rawAgentOutput: string;
}

async function buildScoringRawOutput(
  cvText: string,
  validatedSkills: string[],
  jobTitle: string,
  keywordOnly: boolean
): Promise<{ rawAgentOutput: string; isEstimated: boolean }> {
  if (keywordOnly) {
    return {
      rawAgentOutput: buildKeywordFallbackJson(validatedSkills, cvText),
      isEstimated: true,
    };
  }

  try {
    const raw = await scoreSkills(cvText, validatedSkills);
    try {
      const { json, uniformReplacedWithKeywords } = normalizeLlmScoringJson(
        raw,
        validatedSkills,
        cvText
      );
      if (uniformReplacedWithKeywords) {
        logLlmScoringUniformReplaced(jobTitle);
      } else {
        logLlmScoringOk(jobTitle);
      }
      return { rawAgentOutput: json, isEstimated: false };
    } catch {
      // The LLM answered but not in a shape we can normalize (fenced JSON,
      // prose preamble, wrong structure). Passing the raw string downstream
      // made parseAndSaveAnalysis throw and the whole analyze request 500 -
      // treat it like any other LLM failure and fall back to keyword scoring.
      logLlmScoringRawUnnormalized(jobTitle);
      return {
        rawAgentOutput: buildKeywordFallbackJson(validatedSkills, cvText),
        isEstimated: true,
      };
    }
  } catch {
    logFallbackScoring();
    return {
      rawAgentOutput: buildKeywordFallbackJson(validatedSkills, cvText),
      isEstimated: true,
    };
  }
}

/** Score a CV against skills using the same pipeline as POST /analyze, without persisting. */
export async function scoreCvMatchOnly(req: ScoreRequest): Promise<ScoreMatchResult> {
  if (!mongoose.isValidObjectId(req.jobId)) {
    throw new ValidationError('Invalid job ID format');
  }
  if (!req.cvText || req.cvText.trim().length < MIN_CV_TEXT_LENGTH) {
    throw new ValidationError('cvText is too short to analyze');
  }

  const expectedSkillCount = req.expectedSkillCount ?? 10;
  const validatedSkills = validateSkillArray(req.skills, expectedSkillCount);
  const { rawAgentOutput, isEstimated } = await buildScoringRawOutput(
    req.cvText,
    validatedSkills,
    req.jobTitle,
    req.keywordOnly ?? false
  );

  return {
    matchScore: computeMatchScoreFromRaw(rawAgentOutput, expectedSkillCount),
    isEstimated,
    skills: parseSkillScoresFromRaw(rawAgentOutput, expectedSkillCount).map(
      ({ skill, score, evidence, missing }) => ({ name: skill, score, evidence, missing })
    ),
    rawAgentOutput,
  };
}

export async function scoreAndPersist(req: ScoreRequest): Promise<ICvAnalysis> {
  if (!mongoose.isValidObjectId(req.jobId)) {
    throw new ValidationError('Invalid job ID format');
  }
  if (!req.cvText || req.cvText.trim().length < MIN_CV_TEXT_LENGTH) {
    throw new ValidationError('cvText is too short to analyze');
  }

  const expectedSkillCount = req.expectedSkillCount ?? 10;
  const validatedSkills = validateSkillArray(req.skills, expectedSkillCount);

  const baseInput = {
    userId: req.userId,
    cvFileName: req.cvFileName ?? req.jobId,
    cvTextExtracted: req.cvText,
    jobId: req.jobId,
    jobTitle: req.jobTitle,
    extractedSkills: validatedSkills,
    rawAgentOutput: '',
    expectedSkillCount,
    cvOnlyMode: req.cvOnlyMode ?? false,
    isEstimated: false,
  };

  const { rawAgentOutput, isEstimated } = await buildScoringRawOutput(
    req.cvText,
    validatedSkills,
    req.jobTitle,
    req.keywordOnly ?? false
  );
  baseInput.rawAgentOutput = rawAgentOutput;
  baseInput.isEstimated = isEstimated;
  return parseAndSaveAnalysis(baseInput);
}
