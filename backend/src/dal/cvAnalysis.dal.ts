import { Types } from 'mongoose';
import { CvAnalysis, ICvAnalysis } from '../models/cvAnalysis.model';

// Shape the scoring agent is expected to return
export interface AgentScoringResponse {
  skills: Array<{ skill: string; score: number }>;
  explanation?: string;
}

// Caller-supplied context needed to build a complete analysis document
export interface SaveAnalysisInput {
  userId?: string;
  cvFileName: string;
  cvTextExtracted: string;
  jobId: string;
  jobTitle: string;
  extractedSkills: string[];
  rawAgentOutput: string; // the raw string returned by the agent
  expectedSkillCount?: number;
  cvOnlyMode?: boolean;
  isEstimated?: boolean;
}

class AgentResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentResponseError';
  }
}

function parseAgentResponse(raw: string, expectedSkillCount: number): AgentScoringResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AgentResponseError('Agent response is not valid JSON');
  }

  const response = parsed as AgentScoringResponse;

  if (!Array.isArray(response?.skills)) {
    throw new AgentResponseError('Agent response missing "skills" array');
  }
  if (response.skills.length !== expectedSkillCount) {
    throw new AgentResponseError(
      `Expected exactly ${expectedSkillCount} skill scores, got ${response.skills.length}`
    );
  }
  for (const entry of response.skills) {
    if (typeof entry.skill !== 'string' || typeof entry.score !== 'number') {
      throw new AgentResponseError('Each skill entry must have a string "skill" and numeric "score"');
    }
  }

  return response;
}

function clamp(score: number): number {
  return Math.min(10, Math.max(0, Math.round(score)));
}

function calcMatchScore(scores: number[]): number {
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / scores.length) * 10) / 10; // 1 decimal place
}

/** Compute match score from raw agent JSON without persisting. */
export function computeMatchScoreFromRaw(rawAgentOutput: string, expectedSkillCount: number): number {
  const agentResponse = parseAgentResponse(rawAgentOutput, expectedSkillCount);
  const scores = agentResponse.skills.map(({ score }) => clamp(score));
  return calcMatchScore(scores);
}

export function parseSkillScoresFromRaw(
  rawAgentOutput: string,
  expectedSkillCount: number
): Array<{ skill: string; score: number }> {
  const agentResponse = parseAgentResponse(rawAgentOutput, expectedSkillCount);
  return agentResponse.skills.map(({ skill, score }) => ({
    skill,
    score: clamp(score),
  }));
}

// Parse raw agent output, validate, enforce bounds, calculate matchScore, persist
export async function parseAndSaveAnalysis(input: SaveAnalysisInput): Promise<ICvAnalysis> {
  const expectedSkillCount = input.expectedSkillCount ?? 10;
  const agentResponse = parseAgentResponse(input.rawAgentOutput, expectedSkillCount);

  const scores = agentResponse.skills.map(({ skill, score }) => ({
    skill,
    score: clamp(score),
  }));

  const matchScore = calcMatchScore(scores.map((s) => s.score));

  return CvAnalysis.create({
    ...(input.userId ? { userId: new Types.ObjectId(input.userId) } : {}),
    cvFileName: input.cvFileName,
    cvTextExtracted: input.cvTextExtracted,
    jobId: new Types.ObjectId(input.jobId),
    jobTitle: input.jobTitle,
    extractedSkills: input.extractedSkills,
    scores,
    matchScore,
    cvOnlyMode: input.cvOnlyMode ?? false,
    isEstimated: input.isEstimated ?? false,
    rawAgentOutput: input.rawAgentOutput,
  });
}

export async function getAnalysisById(id: string): Promise<ICvAnalysis | null> {
  return CvAnalysis.findById(id);
}
