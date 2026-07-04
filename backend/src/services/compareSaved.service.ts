import { Types } from 'mongoose';
import { CvFile } from '../models/cvFile.model';
import { ICvAnalysis } from '../models/cvAnalysis.model';
import { parseAndSaveAnalysis } from '../dal/cvAnalysis.dal';
import { scoreCvMatchOnly, ScoreMatchResult } from './scoring.service';
import { ValidationError } from '../errors';
import { validateSkillArray } from '../utils/validateSkills';
import {
  logCompareStarredBetter,
  logCompareStarredNone,
  logCompareStarredStart,
} from '../utils/logger';

export const MAX_SAVED_CVS = 10;
export const MAX_FAVORITE_CVS = 3;

export interface BestSavedCvResult {
  cvId: string;
  fileName: string;
  matchScore: number;
  analysisId: string;
  jobTitle: string;
  skills: Array<{ name: string; score: number }>;
  cvOnlyMode: boolean;
  isEstimated: boolean;
}

export interface CompareSavedResult {
  bestSavedCv: BestSavedCvResult | null;
}

export interface CompareSavedInput {
  userId: string;
  jobId: string;
  jobTitle: string;
  skills: unknown;
  currentMatchScore: number;
  excludeCvId?: string;
  expectedSkillCount?: number;
  cvOnlyMode?: boolean;
}

export interface AnalyzeWithFavoriteCompareInput {
  userId: string;
  jobId: string;
  jobTitle: string;
  cvText: string;
  skills: string[];
  cvOnlyMode: boolean;
  expectedSkillCount: number;
  excludeCvId?: string;
  cvFileName?: string;
  keywordOnly?: boolean;
}

interface StarredCandidate {
  cvId: string;
  fileName: string;
  cvText: string;
}

async function loadStarredCandidates(
  userId: string,
  excludeCvId?: string
): Promise<StarredCandidate[]> {
  const starred = await CvFile.find({
    userId: new Types.ObjectId(userId),
    isFavorite: true,
  })
    .select('_id fileName cvText')
    .lean();

  const excludeId = excludeCvId?.trim();
  return starred
    .filter((cv) => cv._id.toString() !== excludeId)
    .map((cv) => ({
      cvId: cv._id.toString(),
      fileName: cv.fileName,
      cvText: cv.cvText,
    }));
}

function buildBestSavedCvResult(
  cv: StarredCandidate,
  scored: ScoreMatchResult,
  persisted: ICvAnalysis,
  jobTitle: string,
  cvOnlyMode: boolean
): BestSavedCvResult {
  return {
    cvId: cv.cvId,
    fileName: cv.fileName,
    matchScore: scored.matchScore,
    analysisId: persisted._id.toString(),
    jobTitle,
    skills: scored.skills,
    cvOnlyMode,
    isEstimated: scored.isEstimated,
  };
}

/**
 * Score the uploaded CV and all eligible starred CVs in parallel, then pick the best saved match.
 */
export async function analyzeWithParallelFavoriteCompare(
  input: AnalyzeWithFavoriteCompareInput
): Promise<{ analysis: ICvAnalysis; bestSavedCv: BestSavedCvResult | null }> {
  const candidates = await loadStarredCandidates(input.userId, input.excludeCvId);
  logCompareStarredStart(candidates.length, input.jobTitle);

  const scoreOne = (cvText: string, fileName: string) =>
    scoreCvMatchOnly({
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      cvText,
      skills: input.skills,
      expectedSkillCount: input.expectedSkillCount,
      cvOnlyMode: input.cvOnlyMode,
      keywordOnly: input.keywordOnly,
      cvFileName: fileName,
    });

  const trimmedCvText = input.cvText.trim();
  const [currentScored, ...starredScored] = await Promise.all([
    scoreOne(trimmedCvText, input.cvFileName ?? input.jobId),
    ...candidates.map((cv) => scoreOne(cv.cvText, cv.fileName)),
  ]);

  const analysis = await parseAndSaveAnalysis({
    userId: input.userId,
    cvFileName: input.cvFileName ?? input.jobId,
    cvTextExtracted: trimmedCvText,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    extractedSkills: input.skills,
    rawAgentOutput: currentScored.rawAgentOutput,
    expectedSkillCount: input.expectedSkillCount,
    cvOnlyMode: input.cvOnlyMode,
    isEstimated: currentScored.isEstimated,
  });

  let bestSavedCv: BestSavedCvResult | null = null;
  let bestIdx = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < candidates.length; i++) {
    const scored = starredScored[i];
    if (scored.matchScore > currentScored.matchScore && scored.matchScore > bestScore) {
      bestScore = scored.matchScore;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    const cv = candidates[bestIdx];
    const scored = starredScored[bestIdx];
    logCompareStarredBetter(cv.fileName, scored.matchScore, currentScored.matchScore);

    const persisted = await parseAndSaveAnalysis({
      userId: input.userId,
      cvFileName: cv.fileName,
      cvTextExtracted: cv.cvText,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      extractedSkills: input.skills,
      rawAgentOutput: scored.rawAgentOutput,
      expectedSkillCount: input.expectedSkillCount,
      cvOnlyMode: input.cvOnlyMode,
      isEstimated: scored.isEstimated,
    });

    bestSavedCv = buildBestSavedCvResult(cv, scored, persisted, input.jobTitle, input.cvOnlyMode);
  } else {
    logCompareStarredNone(currentScored.matchScore, candidates.length);
  }

  return { analysis, bestSavedCv };
}

export async function compareAgainstFavoriteCvs(input: CompareSavedInput): Promise<CompareSavedResult> {
  if (typeof input.currentMatchScore !== 'number' || Number.isNaN(input.currentMatchScore)) {
    throw new ValidationError('currentMatchScore must be a number');
  }
  if (!input.jobTitle?.trim()) {
    throw new ValidationError('jobTitle is required');
  }

  const expectedSkillCount = input.expectedSkillCount ?? 10;
  const skills = validateSkillArray(input.skills, expectedSkillCount);
  const cvOnlyMode = input.cvOnlyMode ?? false;

  const candidates = await loadStarredCandidates(input.userId, input.excludeCvId);
  logCompareStarredStart(candidates.length, input.jobTitle);

  if (candidates.length === 0) {
    logCompareStarredNone(input.currentMatchScore, 0);
    return { bestSavedCv: null };
  }

  const scored = await Promise.all(
    candidates.map(async (cv) => {
      const result = await scoreCvMatchOnly({
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        cvText: cv.cvText,
        skills,
        expectedSkillCount,
        cvOnlyMode,
        cvFileName: cv.fileName,
      });
      return { cv, result };
    })
  );

  const bestEntry = scored
    .filter(({ result }) => result.matchScore > input.currentMatchScore)
    .sort((a, b) => b.result.matchScore - a.result.matchScore)[0];

  if (!bestEntry) {
    logCompareStarredNone(input.currentMatchScore, candidates.length);
    return { bestSavedCv: null };
  }

  logCompareStarredBetter(
    bestEntry.cv.fileName,
    bestEntry.result.matchScore,
    input.currentMatchScore
  );

  const persisted = await parseAndSaveAnalysis({
    userId: input.userId,
    cvFileName: bestEntry.cv.fileName,
    cvTextExtracted: bestEntry.cv.cvText,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    extractedSkills: skills,
    rawAgentOutput: bestEntry.result.rawAgentOutput,
    expectedSkillCount,
    cvOnlyMode,
    isEstimated: bestEntry.result.isEstimated,
  });

  return {
    bestSavedCv: buildBestSavedCvResult(
      bestEntry.cv,
      bestEntry.result,
      persisted,
      input.jobTitle,
      cvOnlyMode
    ),
  };
}

export async function enforceSavedCvLimit(userId: Types.ObjectId): Promise<void> {
  const count = await CvFile.countDocuments({ userId });
  if (count < MAX_SAVED_CVS) return;

  const overflow = count - MAX_SAVED_CVS + 1;
  const oldest = await CvFile.find({ userId })
    .sort({ uploadedAt: 1 })
    .limit(overflow)
    .select('_id')
    .lean();

  if (oldest.length === 0) return;

  await CvFile.deleteMany({ _id: { $in: oldest.map((cv) => cv._id) } });
}

export async function setCvFavorite(
  userId: string,
  cvId: string,
  favorite: boolean
): Promise<{ cvId: string; isFavorite: boolean }> {
  const file = await CvFile.findOne({ _id: cvId, userId: new Types.ObjectId(userId) });
  if (!file) {
    throw new ValidationError('CV not found');
  }

  if (favorite) {
    const favoriteCount = await CvFile.countDocuments({
      userId: new Types.ObjectId(userId),
      isFavorite: true,
      _id: { $ne: file._id },
    });
    if (favoriteCount >= MAX_FAVORITE_CVS) {
      throw new ValidationError(`You can star at most ${MAX_FAVORITE_CVS} CVs`);
    }
  }

  file.isFavorite = favorite;
  await file.save();

  return { cvId: file._id.toString(), isFavorite: file.isFavorite };
}
