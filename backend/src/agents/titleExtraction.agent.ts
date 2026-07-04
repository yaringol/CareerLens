import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';

const AGENT_NAME = 'titleExtraction';
const CV_TEXT_MAX_CHARS = 4000;

const SYSTEM_PROMPT = `You are extracting a single field from the raw text of a candidate's CV/resume.

Find the exact job title the candidate states for their current or most recent role - the title they wrote about themselves (e.g. a header line under their name, a "Current role" line, or the heading of their most recent experience entry). Copy it verbatim, or as close to verbatim as possible, exactly as it appears in the text.

Do not infer, summarize, or invent a title that is not actually written in the text. If the candidate did not explicitly state a job title anywhere in this text, answer "NONE".

Output discipline:
- Return ONLY a valid JSON object: {"title": "<exact title as written>"} or {"title": "NONE"}.
- No explanation, no markdown, no surrounding text.`;

/**
 * Extracts the candidate's self-declared job title verbatim from raw CV text.
 * Replaces the previous regex/heuristic header-line parsing (candidate-line
 * splitting, wrapped-line merging, noise filters) - that approach needed
 * repeated patching for the same reason: every candidate formats a CV
 * differently, and no fixed set of layout rules covers all of them. The
 * extracted string is normalized to one of the 59 canonical titles by the
 * existing semantic model (getTitleMatches / DS's `/title/normalize`) - this
 * function only replaces the "find the raw title text" step, not the
 * "map it to our taxonomy" step.
 *
 * Returns null when the LLM determines no title is stated anywhere in the
 * text - a valid outcome, not a failure; callers should fall through to the
 * full-CV classifier in that case. Throws AgentError on any LLM-call failure
 * (network/API/malformed output) - deliberately not swallowed here, so a
 * caller can tell "extraction unavailable" apart from "no title found" and
 * surface it as a hard failure rather than silently degrading to a
 * lower-confidence stage.
 */
export async function extractSelfDeclaredTitle(rawText: string): Promise<string | null> {
  const raw = await llmCall(AGENT_NAME, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `CV text:\n${rawText.slice(0, CV_TEXT_MAX_CHARS)}` },
  ]);

  const parsed = await parseJsonSafe<unknown>(raw, AGENT_NAME);
  if (
    typeof parsed !== 'object' || parsed === null ||
    typeof (parsed as { title?: unknown }).title !== 'string'
  ) {
    throw new AgentError(AGENT_NAME, `Expected {"title": string}, got: ${JSON.stringify(parsed)}`);
  }

  const title = (parsed as { title: string }).title.trim();
  if (!title || title.toUpperCase() === 'NONE') {
    return null;
  }
  return title;
}
