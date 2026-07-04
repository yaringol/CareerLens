import axios from 'axios';
import { MODEL, FALLBACK_MODEL, OPENAI_API_KEY, TEMPERATURE } from './openaiClient';
import { AgentError } from '../../agents/agentError';

const LLM_CALL_ATTEMPTS = Number(process.env.LLM_CALL_ATTEMPTS ?? 2);
const LLM_RETRY_DELAY_MS = Number(process.env.LLM_RETRY_DELAY_MS ?? 700);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS ?? 15000);
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 500);

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function shouldRetry(err: unknown): boolean {
  const message = errorMessage(err).toLowerCase();
  return !(
    message.includes('401') ||
    message.includes('incorrect api key') ||
    message.includes('invalid api key')
  );
}

export async function llmCall(
  agentName: string,
  messages: { role: 'system' | 'user'; content: string }[]
): Promise<string> {
  const callModel = async (model: string): Promise<string> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= LLM_CALL_ATTEMPTS; attempt++) {
      try {
        const response = await axios.post<ChatCompletionResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            model,
            messages,
            temperature: TEMPERATURE,
            max_tokens: OPENAI_MAX_TOKENS,
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: OPENAI_TIMEOUT_MS,
          }
        );
        return response.data.choices?.[0]?.message?.content ?? '';
      } catch (err) {
        lastErr = err;
        if (attempt >= LLM_CALL_ATTEMPTS || !shouldRetry(err)) break;
        await sleep(LLM_RETRY_DELAY_MS * attempt);
      }
    }
    throw lastErr;
  };

  try {
    return await callModel(MODEL);
  } catch (primaryErr) {
    try {
      return await callModel(FALLBACK_MODEL);
    } catch (fallbackErr) {
      throw new AgentError(
        agentName,
        `LLM call failed: primary=${errorMessage(primaryErr)}; fallback=${errorMessage(fallbackErr)}`
      );
    }
  }
}
