import type { TrendingSkill } from './dsModel';

/** Same slugging rule used by focusSkillPool.service.ts's SkillOption ids — the pool
 * shown on the Personalization screen and the pool matched against selectedSkillIds at
 * scoring time must generate identical ids for the same skill name, or a selection
 * silently fails to match. */
export function skillId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Collapses the Personalization screen's two redundant stable/trending weights into
 * one number on the same [0,1] scale as TrendingSkill.stabilityScore: 0 = pure stable
 * preference, 1 = pure trending preference, 0.5 = balanced. personalMatch is excluded
 * — it's a different axis (CV/role fit), not part of the stable<->trending spectrum,
 * so mixing it in would break the "0.5 = balanced" invariant.
 */
export function computeStabilityPreference(stable: number, trending: number): number {
  const total = stable + trending;
  if (total === 0) return 0.5;
  return trending / total;
}

/**
 * Picks 5 of the given (up to 10) DS-model candidate skills for the CORE section,
 * ranked purely by how closely each skill's own stabilityScore matches the user's
 * stabilityPreference (ascending distance — the whole point of this function), with
 * prevalence (relevance to the role) used ONLY to break near-ties in that distance,
 * never blended arithmetically with it — a blend would let a highly-relevant-but-
 * poorly-matching skill outrank a well-matching one just for having higher raw
 * prevalence, defeating the preference.
 *
 * This is the ONLY filter applied to the core section — it intentionally does not
 * take the user's manually selected focus skills. Those apply to the DYNAMIC section
 * instead (see selectDynamicSkills), which is sourced from a different pool (the LLM/
 * job-posting-derived candidates from fetchFocusSkillPool, not the DS trending list).
 * Core and dynamic are two independent sources with two independent filters — mixing
 * selectedSkillIds into core selection would collapse that separation and mean the
 * user's focus-skill picks never actually change the dynamic section they're meant for.
 */
export function selectPersonalizedSkills(
  candidates: TrendingSkill[],
  stabilityPreference: number
): string[] {
  const ranked = candidates
    .map((c) => ({
      skill: c.skill,
      distance: Math.abs(c.stabilityScore - stabilityPreference),
      prevalence: c.prevalence ?? 0,
    }))
    .sort((a, b) => a.distance - b.distance || b.prevalence - a.prevalence);

  return ranked.slice(0, 5).map((r) => r.skill);
}

/**
 * Picks 5 skills for the DYNAMIC section from the focus-skill pool (see
 * fetchFocusSkillPool), preferring the user's explicit selectedSkillIds (the
 * Personalization screen's Focus Skills panel) in the order given, then filling any
 * remaining slots from the pool's own default-selected order.
 */
export function selectDynamicSkills(
  pool: Array<{ id: string; name: string; selectedByDefault: boolean }>,
  selectedSkillIds: string[]
): string[] {
  const byId = new Map(pool.map((p) => [p.id, p]));

  const chosen: string[] = [];
  const chosenLower = new Set<string>();
  for (const id of selectedSkillIds) {
    if (chosen.length >= 5) break;
    const match = byId.get(id);
    if (match && !chosenLower.has(match.name.toLowerCase())) {
      chosen.push(match.name);
      chosenLower.add(match.name.toLowerCase());
    }
  }

  for (const p of pool) {
    if (chosen.length >= 5) break;
    if (!p.selectedByDefault) continue;
    if (chosenLower.has(p.name.toLowerCase())) continue;
    chosen.push(p.name);
    chosenLower.add(p.name.toLowerCase());
  }

  for (const p of pool) {
    if (chosen.length >= 5) break;
    if (chosenLower.has(p.name.toLowerCase())) continue;
    chosen.push(p.name);
    chosenLower.add(p.name.toLowerCase());
  }

  return chosen;
}
