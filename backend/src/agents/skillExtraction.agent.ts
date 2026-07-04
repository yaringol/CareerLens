import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';
import { logSkillExtractionAgentPayload } from '../utils/logger';
import { dedupeSkills } from '../utils/skillDedup';

const AGENT_NAME = 'skillExtraction';

/** Total skills returned from every extraction (full picker pool). */
export const SKILL_POOL_SIZE = 10;

/** Primary dynamic skills - used by standard analyze (slots 6-10). */
export const TOP_SKILL_COUNT = 5;

/** User message prefix - keep in sync with `logSkillExtractionAgentPayload` wording in logger. */
const USER_MESSAGE_PREFIX = 'Job description:\n';

const SYSTEM_PROMPT = `You are a senior technical recruiter who distills job postings into the concrete skills that actually drive hiring decisions.

Return a JSON object with exactly two arrays:
- "topFive": exactly 5 highest-priority skills - explicit or strongly implied requirements that most drive hiring for this role.
- "additional": exactly 5 next-most-relevant skills - still posting-grounded, with no overlap or near-duplicates of topFive.

Rules for all 10 skills:
- Prefer specific, assessable hard skills and technologies (e.g. "Python programming", "Kubernetes", "distributed systems design") over vague terms ("coding", "team player", "communication").
- Favor skills most central to succeeding in the role; ignore boilerplate, perks, and company description.
- Use canonical, resume-ready skill names.
- All 10 entries must be distinct: no repeats, no case-only variants (e.g. do not include both "Node.js" and "node js"), and no near-duplicates that refer to the same technology or concept with different punctuation or wording.

Output discipline:
- Return ONLY valid JSON: {"topFive":["..."],"additional":["..."]}
- No explanation, no markdown, no surrounding text.`;

export interface SkillExtractionResult {
  /** All 10 posting-derived skills, highest priority first. */
  pool: string[];
  /** Primary 5 for standard analyze - always pool.slice(0, 5). */
  topFive: string[];
}

function parseSkillStrings(items: unknown, field: string): string[] {
  if (!Array.isArray(items)) {
    throw new AgentError(AGENT_NAME, `${field} must be a JSON array, got: ${JSON.stringify(items)}`);
  }
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new AgentError(AGENT_NAME, `${field} items must be non-empty strings, got: ${JSON.stringify(item)}`);
    }
    out.push(item.trim());
  }
  return out;
}

function buildPool(topFiveRaw: string[], additionalRaw: string[]): SkillExtractionResult {
  const pool = dedupeSkills([...topFiveRaw, ...additionalRaw], SKILL_POOL_SIZE);
  if (pool.length < TOP_SKILL_COUNT) {
    throw new AgentError(
      AGENT_NAME,
      `Expected at least ${TOP_SKILL_COUNT} unique skills after deduplication, got ${pool.length}: ${JSON.stringify(pool)}`
    );
  }
  const trimmed = pool.slice(0, SKILL_POOL_SIZE);
  return { pool: trimmed, topFive: trimmed.slice(0, TOP_SKILL_COUNT) };
}

/** Extract a fixed 10-skill pool from a job posting; topFive are the primary dynamic skills. */
export async function extractSkillPool(jobDescription: string): Promise<SkillExtractionResult> {
  const userContent = `${USER_MESSAGE_PREFIX}${jobDescription}`;
  logSkillExtractionAgentPayload({
    jobDescriptionChars: jobDescription.length,
    userMessageChars: userContent.length,
  });

  const raw = await llmCall(AGENT_NAME, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]);

  const parsed = await parseJsonSafe<{ topFive?: unknown; additional?: unknown }>(raw, AGENT_NAME);
  const topFiveRaw = parseSkillStrings(parsed.topFive, 'topFive');
  const additionalRaw = parseSkillStrings(parsed.additional, 'additional');

  if (topFiveRaw.length < TOP_SKILL_COUNT) {
    throw new AgentError(
      AGENT_NAME,
      `topFive must have at least ${TOP_SKILL_COUNT} skills, got ${topFiveRaw.length}`
    );
  }
  const extraNeeded = SKILL_POOL_SIZE - TOP_SKILL_COUNT;
  if (additionalRaw.length < extraNeeded) {
    throw new AgentError(
      AGENT_NAME,
      `additional must have at least ${extraNeeded} skills, got ${additionalRaw.length}`
    );
  }

  return buildPool(topFiveRaw, additionalRaw);
}
