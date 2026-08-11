import { llmCall } from './llmCall';
import { AgentError } from '../../agents/agentError';

export async function parseJsonSafe<T>(raw: string, agentName: string): Promise<T> {
  const tryParse = (text: string): T | null => {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  let result = tryParse(raw);
  if (result !== null) return result;

  // Models routinely wrap valid JSON in ```json fences or a sentence of
  // preamble. Extract the outermost JSON object/array locally before paying
  // for a second LLM round-trip.
  const embedded = raw.match(/[{[][\s\S]*[}\]]/);
  if (embedded) {
    result = tryParse(embedded[0]);
    if (result !== null) return result;
  }

  const repaired = await llmCall(agentName, [
    {
      role: 'user',
      content: `The following is not valid JSON. Return only the corrected JSON:\n${raw}`,
    },
  ]);
  result = tryParse(repaired);
  if (result !== null) return result;

  throw new AgentError(agentName, 'Response could not be parsed as JSON after repair attempt');
}
