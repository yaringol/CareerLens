import axios from 'axios';
import { DsModelError } from '../errors';
import { classifyTitleWithLlm } from '../agents/titleClassification.agent';
import { extractSelfDeclaredTitle } from '../agents/titleExtraction.agent';
import {
  logTitleLlmFallbackUsed,
  logTitleLlmFallbackFailed,
  logTitleExtractionOk,
  logTitleExtractionNone,
  logTitleExtractionFailed,
} from '../utils/logger';

const DS_MODEL_URL = process.env.DS_MODEL_URL ?? 'http://localhost:8000';
// 5s was sized for the pure-sklearn classifier. Since the M19 agreement signal
// landed on /cv/role, a headerless CV also pays a SkillNer pass (measured
// 1.2-7.4s), so the old ceiling turned a slow-but-correct detection into a
// user-facing 503. Env-overridable so the demo box can tune it without a build.
const DS_MODEL_TIMEOUT_MS = Number(process.env.DS_MODEL_TIMEOUT_MS ?? '15000');

// Below this normalised confidence (0-100) for ALL classifier candidates, the CV
// is routed to the closed-list LLM fallback - typically roles the classifier has
// no training data for (security/hardware/research specialisations). Calibrated
// on the classifier's holdout; override with TITLE_LLM_FALLBACK_THRESHOLD.
const TITLE_LLM_FALLBACK_THRESHOLD = Number(process.env.TITLE_LLM_FALLBACK_THRESHOLD ?? '55');

// Confidence attached to an accepted LLM-fallback title: above the UI auto-accept
// bar (it was chosen deliberately from the closed list), below a slam-dunk
// classifier hit, so it still reads as reviewable in the UI.
const LLM_FALLBACK_CONFIDENCE = 70;

interface SkillMatch {
  doc_node_value: string;
  score?: number;
}

interface SkillNerResponse {
  full_matches: SkillMatch[];
  ngram_matches: SkillMatch[];
}

export interface TitleMatchSuggestion {
  canonicalTitle: string;
  matchedVariant: string;
  confidence: number;
  source?: RoleDetectionSource;
}

interface CVTitleDetectionResponse {
  job_title: string;
  canonical_title?: string;
  confidence: number;
  // M19 agreement signal (see ExtractTitleResult below): /cv/role attaches the
  // same three fields to every candidate item to keep the list shape compatible.
  agreement?: 'agree' | 'disagree' | 'rejects' | 'not_covered' | 'no_skills' | 'skipped_high_confidence';
  skills_model_title?: string | null;
  skills_model_confidence?: number;
}

type AgreementSignalFields = Pick<
  ExtractTitleResult,
  'agreement' | 'skills_model_title' | 'skills_model_confidence'
>;

export type RoleDetectionSource = 'title_extraction' | 'classifier' | 'llm_fallback';

export interface DetectedRole {
  jobTitle: string;       // what the classifier detected (may be unsupported by skills KNN)
  canonicalTitle: string; // title aligned to the skills taxonomy (safe to send downstream)
  confidence: number;     // normalised share (0-100)
  source: RoleDetectionSource;
}

/**
 * Calls /cv/role - the classifier maps free text (CV body or a typed title)
 * to the nearest supported canonical job titles, ranked by confidence.
 */
async function classifyRoles(
  text: string
): Promise<{ roles: DetectedRole[]; signal?: AgreementSignalFields }> {
  try {
    const response = await axios.get<CVTitleDetectionResponse[]>(
      `${DS_MODEL_URL}/cv/role`,
      {
        params: { text },
        timeout: DS_MODEL_TIMEOUT_MS,
      }
    );
    const first = (response.data ?? [])[0];
    const signal: AgreementSignalFields | undefined = first?.agreement
      ? {
          agreement: first.agreement,
          skills_model_title: first.skills_model_title ?? null,
          skills_model_confidence: first.skills_model_confidence,
        }
      : undefined;
    const roles = (response.data ?? [])
      .map((item) => {
        const jobTitle = typeof item.job_title === 'string' ? item.job_title.trim() : '';
        const canonicalTitle =
          typeof item.canonical_title === 'string' && item.canonical_title.trim()
            ? item.canonical_title.trim()
            : jobTitle;
        return {
          jobTitle,
          canonicalTitle,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0,
          source: 'classifier' as const,
        };
      })
      .filter((role) => role.jobTitle);
    return { roles, signal };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new DsModelError('DS model service is unavailable', 503);
      }
      throw new DsModelError(`DS model request failed: ${err.message}`);
    }
    throw err;
  }
}

/**
 * CV->title detection ladder: (1) an LLM extracts the candidate's self-declared
 * title verbatim from the CV text, normalized against the 59 canonical titles
 * via semantic nearest-centroid, (2) fall back to the full-CV-body classifier
 * when no self-declared title is found, (3) when every remaining candidate is
 * below the calibrated confidence threshold, fall back to a second LLM call
 * constrained to the closed 59-title list. The system always answers from
 * within the closed scope - extraction, classifier, or LLM - and tags which
 * one produced the result. Steps 1-2 happen in extractTitleFromCv; this
 * function only adds the closed-list LLM rung.
 */
export async function detectTitleFromCv(text: string, headerText?: string): Promise<DetectedRole[]> {
  const ladder = await extractTitleFromCv(text, headerText);
  const roles: DetectedRole[] = (ladder.candidates ?? [])
    .map((item) => {
      const jobTitle = typeof item.job_title === 'string' ? item.job_title.trim() : '';
      const canonicalTitle =
        typeof item.canonical_title === 'string' && item.canonical_title.trim()
          ? item.canonical_title.trim()
          : jobTitle;
      return {
        jobTitle,
        canonicalTitle,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        source: 'classifier' as const,
      };
    })
    .filter((role) => role.jobTitle);

  // The ladder's top candidate is the title-extraction hit when it resolved
  // confidently (see extractTitleFromCv above) - tag it distinctly from a
  // plain full-body classifier guess.
  if (ladder.source === 'title_extraction' && roles[0]) {
    roles[0] = { ...roles[0], source: 'title_extraction' };
  }

  const allBelowThreshold =
    roles.length === 0 || roles.every((r) => r.confidence < TITLE_LLM_FALLBACK_THRESHOLD);
  if (!allBelowThreshold) {
    return roles;
  }

  try {
    const llmTitle = await classifyTitleWithLlm(text);
    if (llmTitle) {
      logTitleLlmFallbackUsed(llmTitle, ladder.agreement);
      const fallbackRole: DetectedRole = {
        jobTitle: llmTitle,
        canonicalTitle: llmTitle,
        confidence: LLM_FALLBACK_CONFIDENCE,
        source: 'llm_fallback',
      };
      // LLM pick first; classifier candidates stay as alternatives in the UI.
      return [fallbackRole, ...roles.filter((r) => r.canonicalTitle !== llmTitle)];
    }
  } catch (err) {
    // Fallback must never block the flow - low-confidence classifier results
    // still let the user pick manually in the UI.
    logTitleLlmFallbackFailed(String(err));
  }
  return roles;
}

/**
 * Calls /text/skills (SkillNer) - extracts skills from raw job description text.
 * Returns top N deduplicated skills, full matches first then ngram by score.
 */
export async function getSkillsFromText(text: string, topN = 5): Promise<string[]> {
  try {
    const response = await axios.get<SkillNerResponse>(
      `${DS_MODEL_URL}/text/skills`,
      {
        params: { text },
        timeout: DS_MODEL_TIMEOUT_MS,
      }
    );

    const { full_matches = [], ngram_matches = [] } = response.data ?? {};

    const seen = new Set<string>();
    const skills: string[] = [];

    // Full matches first (score = 1.0, highest confidence)
    for (const m of full_matches) {
      const sk = m.doc_node_value?.toLowerCase().trim();
      if (sk && sk.length > 2 && !seen.has(sk)) {
        seen.add(sk);
        skills.push(m.doc_node_value.trim());
      }
    }

    // Ngram matches sorted by score descending, threshold >= 0.75
    const sortedNgram = ngram_matches
      .filter((m) => (m.score ?? 0) >= 0.75)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    for (const m of sortedNgram) {
      if (skills.length >= topN) break;
      const sk = m.doc_node_value?.toLowerCase().trim();
      if (sk && sk.length > 2 && !seen.has(sk)) {
        seen.add(sk);
        skills.push(m.doc_node_value.trim());
      }
    }

    if (skills.length === 0) {
      throw new DsModelError('SkillNer returned no skills for the given text');
    }

    return skills.slice(0, topN);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new DsModelError('DS model service is unavailable', 503);
      }
      throw new DsModelError(`DS model request failed: ${err.message}`);
    }
    throw err;
  }
}

export async function getCoreSkills(jobTitle: string, topN = 5): Promise<string[] | null> {
  try {
    const response = await axios.get<{ suggested_skills: string[]; matched_canonical?: string }>(
      `${DS_MODEL_URL}/title/skills`,
      {
        params: { title: jobTitle, top_n: topN },
        timeout: DS_MODEL_TIMEOUT_MS,
      }
    );

    const skills = response.data?.suggested_skills;

    if (!Array.isArray(skills) || skills.length === 0) {
      throw new DsModelError(`DS model returned empty skills for "${jobTitle}"`);
    }

    return skills;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new DsModelError('DS model service is unavailable', 503);
      }
      throw new DsModelError(`DS model request failed: ${err.message}`);
    }
    throw err;
  }
}

export type SkillTrend = 'rising' | 'stable' | 'falling';

export interface TrendingSkill {
  skill: string;
  trend: SkillTrend;
  prevalence: number | null;
  // 0..1: 0 = flat/stable over time, 1 = steep/trendy. Slope of monthly occurrence,
  // fit at train time (see ds/model/train.py's compute_stability_features). Defaults
  // to a neutral 0.5 (with timeFeaturesReliable=false) when there isn't enough dated
  // history yet - never a crash/error.
  stabilityScore: number;
  timeFeaturesReliable: boolean;
}

/**
 * Calls /title/trending-skills - recency-weighted skills for a role, each tagged with a
 * rising/stable/falling trend plus a stability score. Intended to run before analyze so
 * the dynamic skill slots favour what is currently in demand.
 */
/** True when the DS model marks this role's skill data as too thin to trust
 *  (fewer postings than its minimum-records floor). Fails open to false. */
export async function isRoleDataLimited(title: string): Promise<boolean> {
  try {
    const response = await axios.get<{ limited_data?: unknown }>(
      `${DS_MODEL_URL}/title/skills`,
      { params: { title, top_n: 1 }, timeout: DS_MODEL_TIMEOUT_MS }
    );
    return response.data.limited_data === true;
  } catch {
    return false;
  }
}

export async function getTrendingSkills(title: string, n = 5): Promise<TrendingSkill[]> {
  try {
    const response = await axios.get<{
      skills?: Array<{
        skill?: unknown;
        trend?: unknown;
        prevalence?: unknown;
        stability_score?: unknown;
        time_features_reliable?: unknown;
      }>;
    }>(`${DS_MODEL_URL}/title/trending-skills`, {
      params: { title, n },
      timeout: DS_MODEL_TIMEOUT_MS,
    });

    return (response.data?.skills ?? [])
      .map((s) => ({
        skill: typeof s.skill === 'string' ? s.skill.trim() : '',
        trend: (s.trend === 'rising' || s.trend === 'falling' ? s.trend : 'stable') as SkillTrend,
        prevalence: typeof s.prevalence === 'number' ? s.prevalence : null,
        stabilityScore: typeof s.stability_score === 'number' ? s.stability_score : 0.5,
        timeFeaturesReliable: s.time_features_reliable === true,
      }))
      .filter((s) => s.skill);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new DsModelError('DS model service is unavailable', 503);
      }
      throw new DsModelError(`DS model request failed: ${err.message}`);
    }
    throw err;
  }
}

export interface ExtractTitleResult {
  extracted_title: string | null;
  // Title as originally found, before seniority/employment-type words were
  // stripped for display (e.g. "Middle/Senior React Developer" - extracted_title
  // would be "React Developer"). Optional: absent on older DS versions.
  raw_title?: string | null;
  // Seniority words detected in raw_title ("Senior", "Junior", "Lead", ...),
  // empty if none. Not yet surfaced in the UI - available for a future display.
  seniority?: string[];
  canonical_title: string | null;
  confidence: number;
  low_confidence: boolean;
  source: 'title_extraction' | 'cv_classifier';
  candidates: CVTitleDetectionResponse[];
  // M19 agreement signal (optional - absent when AGREEMENT_SIGNAL_ENABLED is off
  // on the DS side): whether the skills->title router concurred with the ladder's
  // answer. 'disagree'/'rejects' arrive with confidences already capped below the
  // LLM threshold, so no routing logic is needed here - logged for analysis only.
  agreement?: 'agree' | 'disagree' | 'rejects' | 'not_covered' | 'no_skills' | 'skipped_high_confidence';
  skills_model_title?: string | null;
  skills_model_confidence?: number;
}

// Below this normalised confidence (0-100), an extraction/classifier result is
// flagged low_confidence. Reuses the same calibrated value as the ladder's LLM
// rung (TITLE_LLM_FALLBACK_THRESHOLD) rather than a second, independent number.
const TITLE_EXTRACTION_LOW_CONFIDENCE = TITLE_LLM_FALLBACK_THRESHOLD;

/**
 * headerText, when provided, carries the CV's original first lines (real line
 * breaks, original case/punctuation) - separate from cvText, which has
 * already been flattened/lowercased for the other consumers built around it.
 * The LLM extraction below reads whichever is available; headerText is
 * preferred when present since it is unflattened, but the LLM (unlike the
 * regex-based extraction this replaces) does not strictly require it - it can
 * still read a title out of flattened/lowercased cvText if that's all it gets.
 *
 * Ladder: (1) ask an LLM for the candidate's self-declared title verbatim
 * (extractSelfDeclaredTitle) and, if found, normalize it against the 59
 * canonical titles via the existing semantic model (getTitleMatches ->
 * DS's `/title/normalize`); (2) if no self-declared title is found (a valid
 * "NONE" answer, not a failure), fall back to the full-CV-body classifier
 * (classifyRoles -> DS's `/cv/role`). If the extraction LLM itself fails
 * (network/API failure), continue to the classifier so role detection still
 * works while the optional extraction rung is unavailable.
 */
export async function extractTitleFromCv(cvText: string, headerText?: string): Promise<ExtractTitleResult> {
  const rawText = headerText || cvText;
  let selfDeclaredTitle: string | null = null;
  try {
    selfDeclaredTitle = await extractSelfDeclaredTitle(rawText);
  } catch (err) {
    logTitleExtractionFailed(err instanceof Error ? err.message : String(err));
  }

  if (selfDeclaredTitle) {
    const { suggestions } = await getTitleMatches(selfDeclaredTitle);
    const top = suggestions[0];
    if (top) {
      logTitleExtractionOk(selfDeclaredTitle, top.canonicalTitle, top.confidence);
      return {
        extracted_title: selfDeclaredTitle,
        raw_title: selfDeclaredTitle,
        seniority: [],
        canonical_title: top.canonicalTitle,
        confidence: top.confidence,
        low_confidence: top.confidence < TITLE_EXTRACTION_LOW_CONFIDENCE,
        source: 'title_extraction',
        candidates: suggestions.map((s) => ({
          job_title: s.matchedVariant,
          canonical_title: s.canonicalTitle,
          confidence: s.confidence,
        })),
      };
    }
  } else {
    logTitleExtractionNone();
  }

  // No self-declared title found (or normalize returned nothing usable) -
  // fall back to the full-CV-body classifier, same as before. This is the rung
  // where the DS-side agreement signal lives (/cv/role): boosted/capped
  // confidences arrive already applied; the signal fields are passed through
  // so the LLM-fallback log can name which signal triggered it.
  const { roles, signal } = await classifyRoles(cvText);
  const top = roles[0];
  return {
    extracted_title: selfDeclaredTitle,
    raw_title: selfDeclaredTitle,
    seniority: [],
    canonical_title: top ? top.canonicalTitle : null,
    confidence: top ? top.confidence : 0,
    low_confidence: (top ? top.confidence : 0) < TITLE_EXTRACTION_LOW_CONFIDENCE,
    source: 'cv_classifier',
    candidates: roles.map((r) => ({
      job_title: r.jobTitle,
      canonical_title: r.canonicalTitle,
      confidence: r.confidence,
    })),
    ...(signal ?? {}),
  };
}

export function rolesToSuggestions(roles: DetectedRole[]): TitleMatchSuggestion[] {
  return roles.slice(0, 3).map((role) => ({
    canonicalTitle: role.canonicalTitle,  // aligned to skills taxonomy (used downstream)
    matchedVariant: role.jobTitle,         // the raw detected title
    confidence: role.confidence,
    source: role.source,
  }));
}

interface TitleNormalizeSuggestion {
  canonical_title: string;
  matched_variant?: string;
  confidence: number;
}

/**
 * Manual title search (e.g. "Sr. SWE" typed by the user when auto-detection
 * misses): calls DS's /title/normalize, which runs the short-title semantic
 * nearest-centroid model directly. This must never go through classifyRoles/
 * /cv/role - that classifier is trained on full CV bodies, and its TF-IDF
 * vocabulary/weighting is tuned for thousand-word documents, not a 2-4 word
 * query (the same class of train/serve mismatch as feeding a full CV into a
 * titles-only model, just in the opposite direction).
 */
export async function getTitleMatches(title: string): Promise<{ suggestions: TitleMatchSuggestion[] }> {
  try {
    const response = await axios.get<{ suggestions: TitleNormalizeSuggestion[] }>(
      `${DS_MODEL_URL}/title/normalize`,
      { params: { title }, timeout: DS_MODEL_TIMEOUT_MS }
    );

    const suggestions: TitleMatchSuggestion[] = (response.data?.suggestions ?? [])
      .map((item) => ({
        canonicalTitle: typeof item.canonical_title === 'string' ? item.canonical_title.trim() : '',
        matchedVariant: title.trim(),
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      }))
      .filter((s) => s.canonicalTitle);

    if (suggestions.length === 0) {
      throw new DsModelError(`DS model returned no title matches for "${title}"`);
    }

    return { suggestions };
  } catch (err) {
    if (err instanceof DsModelError) throw err;
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new DsModelError('DS model service is unavailable', 503);
      }
      throw new DsModelError(`DS model request failed: ${err.message}`);
    }
    throw err;
  }
}
