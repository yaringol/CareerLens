/**
 * Minimal production-friendly logging for the POC.
 * Set POC_DEBUG=1 for optional text previews (CV snippets) in cv.service.
 */

const PREFIX = '[CareerLens]';

function isVerboseDebug(): boolean {
  const v = process.env.POC_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Once per process: remind operators that LLM paths may fall back. */
export function logPocStartup(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log(
      `${PREFIX} OPENAI_API_KEY not set — skill extraction and scoring use fallbacks when the API is missing or returns an error.`
    );
  }
}

export function logUploadOk(originalName: string, normalizedLen: number): void {
  console.log(`${PREFIX} Upload OK file=${JSON.stringify(originalName)} normalizedChars=${normalizedLen}`);
}

export function logUploadWarn(message: string): void {
  console.warn(`${PREFIX} Upload: ${message}`);
}

/** Optional: raw/normalized CV snippets for debugging only. */
export function logDebugText(label: string, text: string, maxLen = 300): void {
  if (!isVerboseDebug()) return;
  console.log(`${PREFIX}:debug ${label} len=${text.length}`, JSON.stringify(text.slice(0, maxLen)));
}

export function logAnalyzeOk(jobTitle: string): void {
  console.log(`${PREFIX} Analyze OK job=${JSON.stringify(jobTitle)}`);
}

export function logFallbackDynamicSkills(jobTitle: string, variant: 'per_job' | 'generic'): void {
  const src = variant === 'per_job' ? 'static list for role' : 'generic static list';
  console.log(
    `${PREFIX} Dynamic skills fallback (${src}) job=${JSON.stringify(jobTitle)} — LLM unavailable or failed`
  );
}

export function logFallbackScoring(): void {
  console.log(`${PREFIX} Scoring fallback (keyword overlap) — OpenAI unavailable or response invalid`);
}
