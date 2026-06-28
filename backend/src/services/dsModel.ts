import axios from 'axios';
import { DsModelError } from '../errors';

const DS_MODEL_URL = process.env.DS_MODEL_URL ?? 'http://localhost:8000';
const DS_MODEL_TIMEOUT_MS = 5000;

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
}

interface CVTitleDetectionResponse {
  job_title: string;
  confidence: number;
}

export interface DetectedRole {
  jobTitle: string;
  confidence: number;
}

/**
 * Calls /cv/role — the classifier maps free text (CV body or a typed title)
 * to the nearest supported canonical job titles, ranked by confidence.
 */
async function classifyRoles(text: string): Promise<DetectedRole[]> {
  try {
    const response = await axios.get<CVTitleDetectionResponse[]>(
      `${DS_MODEL_URL}/cv/role`,
      {
        params: { text },
        timeout: DS_MODEL_TIMEOUT_MS,
      }
    );
    return (response.data ?? [])
      .map((item) => ({
        jobTitle: typeof item.job_title === 'string' ? item.job_title.trim() : '',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      }))
      .filter((role) => role.jobTitle);
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

export async function detectTitleFromCv(text: string): Promise<DetectedRole[]> {
  return classifyRoles(text);
}

/**
 * Calls /text/skills (SkillNer) — extracts skills from raw job description text.
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

export async function getCoreSkills(
  jobTitle: string,
  titleMatch = 0.0,
  topN = 5
): Promise<string[] | null> {
  try {
    const response = await axios.get<{ suggested_skills: string[]; matched_canonical?: string }>(
      `${DS_MODEL_URL}/title/skills`,
      {
        params: { title: jobTitle, title_match: titleMatch, top_n: topN },
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

export interface TitleMatchResult {
  canonical: string;
  confidence: number;
}

export interface ExtractTitleResult {
  extracted_title: string | null;
  canonical_title: string | null;
  confidence: number;
  low_confidence: boolean;
}

export async function matchTitle(title: string): Promise<{ matches: TitleMatchResult[]; low_confidence: boolean }> {
  try {
    const response = await axios.get<{ matches: TitleMatchResult[]; low_confidence: boolean }>(
      `${DS_MODEL_URL}/title/match`,
      { params: { title }, timeout: DS_MODEL_TIMEOUT_MS }
    );
    return response.data;
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

export async function extractTitleFromCv(cvText: string): Promise<ExtractTitleResult> {
  try {
    const response = await axios.post<ExtractTitleResult>(
      `${DS_MODEL_URL}/cv/title`,
      { text: cvText },
      { timeout: DS_MODEL_TIMEOUT_MS }
    );
    return response.data;
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

export function rolesToSuggestions(roles: DetectedRole[]): TitleMatchSuggestion[] {
  return roles.slice(0, 3).map((role) => ({
    canonicalTitle: role.jobTitle,
    matchedVariant: role.jobTitle,
    confidence: role.confidence,
  }));
}

export async function getTitleMatches(title: string): Promise<{ suggestions: TitleMatchSuggestion[] }> {
  const roles = await classifyRoles(title);
  const suggestions = rolesToSuggestions(roles).map((suggestion) => ({
    ...suggestion,
    matchedVariant: title.trim(),
  }));

  if (suggestions.length === 0) {
    throw new DsModelError(`DS model returned no title matches for "${title}"`);
  }

  return { suggestions };
}
