import type { TrendingSkill } from './dsModel';

/** Same slugging rule used by personalize.routes.ts's SkillOption ids - both routes
 * must generate identical ids for the same skill name so a selectedSkillIds override
 * from the Personalization screen (built against this id scheme) actually matches. */
export function skillId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Collapses the Personalization screen's two redundant stable/trending weights into
 * one number on the same [0,1] scale as TrendingSkill.stabilityScore: 0 = pure stable
 * preference, 1 = pure trending preference, 0.5 = balanced. personalMatch is excluded
 * - it's a different axis (CV/role fit), not part of the stable<->trending spectrum,
 * so mixing it in would break the "0.5 = balanced" invariant.
 */
export function computeStabilityPreference(stable: number, trending: number): number {
  const total = stable + trending;
  if (total === 0) return 0.5;
  return trending / total;
}

/**
 * Picks 5 of the given (up to 10) candidate skills, ranked primarily by how closely
 * each skill's own stabilityScore matches the user's stabilityPreference (ascending
 * distance - the whole point of this function), with prevalence (relevance to the
 * role) used ONLY to break near-ties in that distance, never blended arithmetically
 * with it - a blend would let a highly-relevant-but-poorly-matching skill outrank a
 * well-matching one just for having higher raw prevalence, defeating the preference.
 * Explicit selectedSkillIds (user manually picked in the UI) always win their slots
 * first; remaining slots are filled by the ranking.
 */
export function selectPersonalizedSkills(
  candidates: TrendingSkill[],
  stabilityPreference: number,
  selectedSkillIds: string[]
): string[] {
  const byId = new Map(candidates.map((c) => [skillId(c.skill), c]));

  const explicit: string[] = [];
  const explicitLower = new Set<string>();
  for (const id of selectedSkillIds) {
    const match = byId.get(id);
    if (match && !explicitLower.has(match.skill.toLowerCase())) {
      explicit.push(match.skill);
      explicitLower.add(match.skill.toLowerCase());
    }
  }
  if (explicit.length >= 5) return explicit.slice(0, 5);

  const ranked = candidates
    .filter((c) => !explicitLower.has(c.skill.toLowerCase()))
    .map((c) => ({
      skill: c.skill,
      distance: Math.abs(c.stabilityScore - stabilityPreference),
      prevalence: c.prevalence ?? 0,
    }))
    .sort((a, b) => a.distance - b.distance || b.prevalence - a.prevalence);

  const chosen = [...explicit];
  for (const { skill } of ranked) {
    if (chosen.length >= 5) break;
    chosen.push(skill);
  }
  return chosen;
}
