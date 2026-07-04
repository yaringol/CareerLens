import axios from 'axios';
import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';

const AGENT_NAME = 'titleClassification';

const DS_MODEL_URL = process.env.DS_MODEL_URL ?? 'http://localhost:8000';
const TITLES_CACHE_TTL_MS = 10 * 60 * 1000;
const CV_TEXT_MAX_CHARS = 6000;

let cachedTitles: string[] | null = null;
let cachedAt = 0;

/** The closed set of supported canonical titles, from the DS /titles endpoint. */
async function getSupportedTitles(): Promise<string[]> {
  if (cachedTitles && Date.now() - cachedAt < TITLES_CACHE_TTL_MS) {
    return cachedTitles;
  }
  const response = await axios.get<{ titles: Array<{ title: string }> }>(
    `${DS_MODEL_URL}/titles`,
    { timeout: 5000 }
  );
  const titles = (response.data?.titles ?? [])
    .map((t) => t.title)
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '');
  if (titles.length === 0) {
    throw new AgentError(AGENT_NAME, 'DS /titles returned an empty title list');
  }
  cachedTitles = titles;
  cachedAt = Date.now();
  return titles;
}

const SYSTEM_PROMPT_HEADER = `You are a senior technical recruiter. Given the raw text of a candidate's CV, identify the candidate's primary current role.

You MUST answer with exactly one job title copied verbatim from the supported list below - this is a closed classification task, no other titles exist. If the CV clearly does not fit any supported title (e.g. it is not an engineering/tech CV at all), answer "none".

Selection rules:
- Judge by the candidate's actual skills, responsibilities and technologies - not just a self-declared headline.
- Prefer the most specific matching title (e.g. "SOC Analyst" over "Cyber Security" when the CV is SOC-monitoring work).
- For hybrid profiles pick the role that dominates the recent experience.

Output discipline:
- Return ONLY a valid JSON object: {"title": "<exact title from the list>"} or {"title": "none"}.
- No explanation, no markdown, no surrounding text.

Supported titles:`;

/**
 * LLM fallback for CV->title detection, constrained to the closed set of
 * supported canonical titles. Used when the neural classifier's confidence is
 * below threshold (typically roles it has no training data for, e.g. the
 * security/hardware/research specialisations).
 *
 * Returns the validated canonical title, or null when the LLM answers "none".
 * Throws AgentError on invalid output (hallucinated title, bad JSON).
 */
export async function classifyTitleWithLlm(cvText: string): Promise<string | null> {
  const titles = await getSupportedTitles();
  const systemPrompt = `${SYSTEM_PROMPT_HEADER}\n${titles.map((t) => `- ${t}`).join('\n')}`;

  const raw = await llmCall(AGENT_NAME, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `CV text:\n${cvText.slice(0, CV_TEXT_MAX_CHARS)}` },
  ]);

  const parsed = await parseJsonSafe<unknown>(raw, AGENT_NAME);
  if (
    typeof parsed !== 'object' || parsed === null ||
    typeof (parsed as { title?: unknown }).title !== 'string'
  ) {
    throw new AgentError(AGENT_NAME, `Expected {"title": string}, got: ${JSON.stringify(parsed)}`);
  }

  const answer = (parsed as { title: string }).title.trim();
  if (answer.toLowerCase() === 'none') {
    return null;
  }

  // Hallucination guard: the answer must exist verbatim in the supported list
  // (case-insensitive match, but the canonical casing is what gets returned).
  const match = titles.find((t) => t.toLowerCase() === answer.toLowerCase());
  if (!match) {
    throw new AgentError(AGENT_NAME, `LLM returned a title outside the supported list: "${answer}"`);
  }
  return match;
}
