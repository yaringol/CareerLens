import OpenAI from 'openai';

export const openai = new OpenAI({
  timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 15000),
  maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 3),
});

export const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const FALLBACK_MODEL = 'gpt-4.1-mini';
export const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE ?? 0.2);
