/**
 * Minimal production-friendly logging for the POC.
 * Set POC_DEBUG=1 for optional text previews (CV snippets, job description input to extractSkills).
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
  } else {
    console.log(`${PREFIX} OPENAI_API_KEY set — LLM enabled for dynamic skills and scoring (watch per-request LLM OK / fallback lines)`);
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

/** Client job description accepted for dynamic extraction (before LLM). */
export function logJobDescriptionForExtraction(jobTitle: string, descriptionChars: number): void {
  console.log(
    `${PREFIX} Job description OK for dynamic skills job=${JSON.stringify(jobTitle)} descriptionChars=${descriptionChars}`
  );
}

/**
 * What `skillExtraction` sends to the chat API: fixed system prompt + one user message
 * `"Job description:\\n" + <full JD text>`.
 */
export function logSkillExtractionAgentPayload(meta: {
  jobDescriptionChars: number;
  userMessageChars: number;
}): void {
  console.log(
    `${PREFIX} skillExtraction → OpenAI: system=fixed rules; user="Job description:\\n"+JD (${meta.jobDescriptionChars} chars); userMessageTotalChars=${meta.userMessageChars}`
  );
}

/** Dynamic skill extraction succeeded via OpenAI (job description → 5 skills). */
export function logLlmDynamicSkillsOk(jobTitle: string, extractedSkills?: string[]): void {
  const skillsPart =
    extractedSkills && extractedSkills.length > 0
      ? ` extracted=${JSON.stringify(extractedSkills)}`
      : '';
  console.log(`${PREFIX} LLM OK dynamic skills job=${JSON.stringify(jobTitle)}${skillsPart}`);
}

/** Scoring used OpenAI output (aligned to the 10 skills). */
export function logLlmScoringOk(jobTitle: string): void {
  console.log(`${PREFIX} LLM OK scoring job=${JSON.stringify(jobTitle)}`);
}

/** Model returned the same score for every skill; replaced with keyword overlap for differentiation. */
export function logLlmScoringUniformReplaced(jobTitle: string): void {
  console.log(
    `${PREFIX} LLM scoring returned uniform scores — using keyword overlap instead job=${JSON.stringify(jobTitle)}`
  );
}

/** Scoring LLM returned text but JSON normalization failed; using raw model output as-is. */
export function logLlmScoringRawUnnormalized(jobTitle: string): void {
  console.log(
    `${PREFIX} LLM scoring OK (raw JSON, normalize skipped) job=${JSON.stringify(jobTitle)}`
  );
}
