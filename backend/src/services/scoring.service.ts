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
  const scored = skills.map((skill) => ({
    skill,
    score: overlapScoreForSkill(skill, cvText),
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
function normalizeLlmScoringJson(
  raw: string,
  expectedSkills: string[],
  cvText: string
): { json: string; uniformReplacedWithKeywords: boolean } {
  const parsed = JSON.parse(raw) as { skills?: unknown };
  if (!Array.isArray(parsed.skills)) {
    throw new Error('Invalid LLM scoring shape');
  }

  const pool = new Map<string, number>();
  for (const row of parsed.skills) {
    if (
      row &&
      typeof row === 'object' &&
      'skill' in row &&
      'score' in row &&
      typeof (row as { skill: unknown }).skill === 'string' &&
      typeof (row as { score: unknown }).score === 'number'
    ) {
      const s = (row as { skill: string; score: number }).skill.trim().toLowerCase();
      pool.set(s, (row as { score: number }).score);
    }
  }

  const aligned = expectedSkills.map((skill) => {
    const k = skill.trim().toLowerCase();
    let score = pool.get(k);
    if (score === undefined) {
      for (const [name, s] of pool) {
        if (name.includes(k) || k.includes(name)) {
          score = s;
          break;
        }
      }
    }
    if (score === undefined) {
      score = overlapScoreForSkill(skill, cvText);
    }
    return { skill, score: Math.round(score) };
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
  skills: Array<{ name: string; score: number }>;
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
      logLlmScoringRawUnnormalized(jobTitle);
      return { rawAgentOutput: raw, isEstimated: false };
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
    skills: parseSkillScoresFromRaw(rawAgentOutput, expectedSkillCount).map(({ skill, score }) => ({
      name: skill,
      score,
    })),
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
