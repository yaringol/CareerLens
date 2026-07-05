import OpenAI from 'openai';

/** Allows the server to boot without a key; LLM calls fail fast and fallbacks handle analyze. */
const apiKey = process.env.OPENAI_API_KEY?.trim() || 'sk-local-dev-no-key';

export const openai = new OpenAI({
  apiKey,
  timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 15000),
  maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 3),
});

export const OPENAI_API_KEY = apiKey;
export const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const FALLBACK_MODEL = 'gpt-4.1-mini';
export const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE ?? 0.2);
