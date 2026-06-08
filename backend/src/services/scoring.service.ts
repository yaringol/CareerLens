import mongoose from 'mongoose';
import { scoreSkills } from '../agents/scoring.agent';
import { parseAndSaveAnalysis } from '../dal/cvAnalysis.dal';
import { ICvAnalysis } from '../models/cvAnalysis.model';
import { validateSkillArray } from '../utils/validateSkills';
import { ValidationError } from '../errors';
import {
  logFallbackScoring,
  logLlmScoringOk,
  logLlmScoringRawUnnormalized,
  logLlmScoringUniformReplaced,
} from '../utils/pocLog';

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

  if (req.keywordOnly) {
    baseInput.rawAgentOutput = buildKeywordFallbackJson(validatedSkills, req.cvText);
    baseInput.isEstimated = true;
    return parseAndSaveAnalysis(baseInput);
  }

  try {
    const raw = await scoreSkills(req.cvText, validatedSkills);
    try {
      const { json, uniformReplacedWithKeywords } = normalizeLlmScoringJson(
        raw,
        validatedSkills,
        req.cvText
      );
      baseInput.rawAgentOutput = json;
      if (uniformReplacedWithKeywords) {
        baseInput.isEstimated = true;
        logLlmScoringUniformReplaced(req.jobTitle);
      } else {
        logLlmScoringOk(req.jobTitle);
      }
    } catch {
      baseInput.rawAgentOutput = raw;
      logLlmScoringRawUnnormalized(req.jobTitle);
    }
    return await parseAndSaveAnalysis(baseInput);
  } catch {
    logFallbackScoring();
    baseInput.isEstimated = true;
    baseInput.rawAgentOutput = buildKeywordFallbackJson(validatedSkills, req.cvText);
    baseInput.isEstimated = true;
    return await parseAndSaveAnalysis(baseInput);
  }
}
