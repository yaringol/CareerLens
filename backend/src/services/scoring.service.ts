import mongoose from 'mongoose';
import { scoreSkills } from '../agents/scoring.agent';
import { parseAndSaveAnalysis } from '../dal/cvAnalysis.dal';
import { ICvAnalysis } from '../models/cvAnalysis.model';
import { validateSkillArray } from '../utils/validateSkills';
import { ValidationError } from '../errors';

const MIN_CV_TEXT_LENGTH = 50;

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

  const rawAgentOutput = await scoreSkills(req.cvText, validatedSkills);

  return parseAndSaveAnalysis({
    cvFileName: req.cvFileName ?? req.jobId,
    cvTextExtracted: req.cvText,
    jobId: req.jobId,
    jobTitle: req.jobTitle,
    extractedSkills: validatedSkills,
    rawAgentOutput,
  });
}
