import { getSkillsFromText, getTrendingSkills } from './dsModel';
import { extractDynamicSkills } from './job.service';
import { skillId } from './personalization.service';

export type SkillSource = 'cv' | 'role' | 'market';

export interface SkillOption {
  id: string;
  name: string;
  source: SkillSource;
  score: number;
  selectedByDefault: boolean;
}

export const ROLE_SKILL_POOL_SIZE = 10;
export const DEFAULT_SELECTED_COUNT = 5;

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function isNearDuplicate(skill: string, existing: string[]): boolean {
  const tokens = tokenSet(skill);
  if (tokens.size === 0) return true;
  return existing.some((item) => jaccardSimilarity(tokens, tokenSet(item)) >= 0.5);
}

/**
 * Builds the posting-aware "focus skill" candidate pool: trending market skills first,
 * then LLM/skillner skills extracted from the job posting, deduped and capped at
 * ROLE_SKILL_POOL_SIZE, with skills near-duplicate to the (already-chosen) core skills
 * excluded. The top DEFAULT_SELECTED_COUNT are flagged selectedByDefault.
 */
export function buildSkillOptions(skills: string[], excludedCoreSkills: string[] = []): SkillOption[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of skills) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    if (isNearDuplicate(name, excludedCoreSkills)) continue;
    seen.add(key);
    ordered.push(name);
    if (ordered.length >= ROLE_SKILL_POOL_SIZE) break;
  }

  const total = ordered.length || 1;
  return ordered.map((name, i) => ({
    id: skillId(name) || `skill-${i}`,
    name,
    source: 'market' as SkillSource,
    score: Number((1 - i / total).toFixed(2)),
    selectedByDefault: i < DEFAULT_SELECTED_COUNT,
  }));
}

/**
 * Fetches the same trending+LLM+skillner candidates the Personalization screen's Focus
 * Skills panel is built from (see POST /api/personalize/options), so ids here match
 * whatever the client selected there — a `selectedSkillIds` lookup against a
 * differently-built pool would silently drop the user's picks.
 */
export async function fetchFocusSkillPool(
  jobTitle: string,
  jobDescription: string,
  excludedCoreSkills: string[] = []
): Promise<SkillOption[]> {
  const [trending, dynamic, skillNer] = await Promise.all([
    getTrendingSkills(jobTitle, ROLE_SKILL_POOL_SIZE).catch(() => []),
    extractDynamicSkills(jobTitle, jobDescription)
      .then((r) => r.extractedSkills)
      .catch(() => [] as string[]),
    getSkillsFromText(jobDescription, ROLE_SKILL_POOL_SIZE).catch(() => [] as string[]),
  ]);
  const candidates = [...trending.map((t) => t.skill), ...dynamic, ...skillNer];
  return buildSkillOptions(candidates, excludedCoreSkills);
}
