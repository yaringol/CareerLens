import { openai, MODEL, FALLBACK_MODEL, TEMPERATURE } from './openaiClient';
import { AgentError } from '../../agents/agentError';

export async function llmCall(
  agentName: string,
  messages: { role: 'system' | 'user'; content: string }[]
): Promise<string> {
  const callModel = async (model: string): Promise<string> => {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: TEMPERATURE,
    });
    return response.choices[0]?.message?.content ?? '';
  };

  try {
    return await callModel(MODEL);
  } catch (primaryErr) {
    try {
      return await callModel(FALLBACK_MODEL);
    } catch {
      throw new AgentError(agentName, `LLM call failed: ${String(primaryErr)}`);
    }
  }
}
