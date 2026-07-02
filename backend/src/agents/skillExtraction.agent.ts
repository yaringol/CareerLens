import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';
import { logSkillExtractionAgentPayload } from '../utils/logger';

const AGENT_NAME = 'skillExtraction';

/** User message prefix — keep in sync with `logSkillExtractionAgentPayload` wording in logger. */
const USER_MESSAGE_PREFIX = 'Job description:\n';

const SYSTEM_PROMPT = `You are a senior technical recruiter who distills job postings into the concrete skills that actually drive hiring decisions.

Extraction rules:
- Return EXACTLY 5 skills that are explicitly stated or strongly implied as requirements.
- Prefer specific, assessable hard skills and technologies (e.g. "Python programming", "Kubernetes", "distributed systems design") over vague or generic terms ("coding", "team player", "communication").
- Favor the skills most central to succeeding in the role; ignore boilerplate, perks, and company description.
- Use canonical, resume-ready skill names. No duplicates or near-duplicates.

Output discipline:
- Return ONLY a valid JSON array of exactly 5 non-empty strings. No explanation, no markdown, no surrounding text.`;

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
