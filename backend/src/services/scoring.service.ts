import mongoose from 'mongoose';
import { scoreSkills } from '../agents/scoring.agent';
import { parseAndSaveAnalysis } from '../dal/cvAnalysis.dal';
import { ICvAnalysis } from '../models/cvAnalysis.model';
import { validateSkillArray } from '../utils/validateSkills';
import { ValidationError } from '../errors';
import { logFallbackScoring } from '../utils/pocLog';

const MIN_CV_TEXT_LENGTH = 50;

/** When LLM is unavailable, score from token overlap so different jobs (different skills) differentiate on the same CV. */
function buildMockAgentJson(skills: string[], cvText: string): string {
  const cv = cvText.toLowerCase();
  const scored = skills.map((skill) => {
    const tokens = skill
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
    if (tokens.length === 0) {
      return { skill, score: 5 };
    }
    const hits = tokens.filter((t) => cv.includes(t)).length;
    const ratio = hits / tokens.length;
    const score = Math.round(3 + ratio * 7);
    return { skill, score: Math.min(10, Math.max(1, score)) };
  });
  return JSON.stringify({ skills: scored });
}

export interface ScoreRequest {
  jobId: string;
  jobTitle: string;
  cvText: string;
  skills: unknown;
  cvFileName?: string;
}

export async function scoreAndPersist(req: ScoreRequest): Promise<ICvAnalysis> {
  if (!mongoose.isValidObjectId(req.jobId)) {
    throw new ValidationError('Invalid job ID format');
  }
  if (!req.cvText || req.cvText.trim().length < MIN_CV_TEXT_LENGTH) {
    throw new ValidationError('cvText is too short to analyze');
  }

  const validatedSkills = validateSkillArray(req.skills, 10);

  const baseInput = {
    cvFileName: req.cvFileName ?? req.jobId,
    cvTextExtracted: req.cvText,
    jobId: req.jobId,
    jobTitle: req.jobTitle,
    extractedSkills: validatedSkills,
    rawAgentOutput: '',
  };

  try {
    baseInput.rawAgentOutput = await scoreSkills(req.cvText, validatedSkills);
    return await parseAndSaveAnalysis(baseInput);
  } catch {
    logFallbackScoring();
    baseInput.rawAgentOutput = buildMockAgentJson(validatedSkills, req.cvText);
    return parseAndSaveAnalysis(baseInput);
  }
}
