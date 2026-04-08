import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';
import { logSkillExtractionAgentPayload } from '../utils/pocLog';

const AGENT_NAME = 'skillExtraction';

/** User message prefix — keep in sync with `logSkillExtractionAgentPayload` wording in pocLog. */
const USER_MESSAGE_PREFIX = 'Job description:\n';

const SYSTEM_PROMPT = `You are a job skills expert.
Read the job description below and extract exactly 5 skills that are
explicitly mentioned or strongly implied.

Rules:
- Return ONLY a valid JSON array of exactly 5 strings.
- Skills must be specific (e.g. "Python programming", not "coding").
- No duplicates. No explanation. No markdown. Just the JSON array.`;

export async function extractSkills(jobDescription: string): Promise<string[]> {
  const userContent = `${USER_MESSAGE_PREFIX}${jobDescription}`;
  logSkillExtractionAgentPayload({
    jobDescriptionChars: jobDescription.length,
    userMessageChars: userContent.length,
  });
  const raw = await llmCall(AGENT_NAME, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]);

  const parsed = await parseJsonSafe<unknown>(raw, AGENT_NAME);

  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new AgentError(AGENT_NAME, `Expected array of 5 skills, got: ${JSON.stringify(parsed)}`);
  }
  for (const item of parsed) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new AgentError(AGENT_NAME, `Each skill must be a non-empty string, got: ${JSON.stringify(item)}`);
    }
  }

  return parsed as string[];
}
