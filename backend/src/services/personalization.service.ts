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

// Mirrors the near-duplicate tokenizer in focusSkillPool.service.ts / analyze.routes.ts
// so "sql" vs "SQL databases" resolves the same way at every stage of the pipeline.
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

/** A pick that the CORE section already covers must not repeat under DYNAMIC —
 * mergeTenSkills would drop the duplicate and the slot would fall through to a
 * generic padding skill. Exact match first; token overlap only when the pick
 * actually has tokens (short names like "C#" tokenize to nothing and must not be
 * swallowed as a false near-duplicate). */
function matchesCore(name: string, coreSkills: string[]): boolean {
  const lower = name.trim().toLowerCase();
  if (coreSkills.some((c) => c.trim().toLowerCase() === lower)) return true;
  const tokens = tokenSet(name);
  if (tokens.size === 0) return false;
  return coreSkills.some((c) => jaccardSimilarity(tokens, tokenSet(c)) >= 0.5);
}

/**
 * Picks 5 skills for the DYNAMIC section from the focus-skill pool (see
 * fetchFocusSkillPool), honoring the user's explicit picks first, then filling any
 * remaining slots from the pool's own default-selected order.
 *
 * selectedSkillNames is the source of truth when present: the pool is re-fetched at
 * scoring time with a *different* core exclusion than the one the Personalization
 * screen used (weighted vs default core) and the LLM extraction is not deterministic,
 * so an id lookup against the re-fetched pool silently dropped picks and back-filled
 * the slots with skills the user never saw. Names are honored verbatim — except picks
 * the weighted CORE section already covers (matchesCore), which already appear and get
 * scored there. selectedSkillIds remains as the fallback for payloads without names.
 */
export function selectDynamicSkills(
  pool: Array<{ id: string; name: string; selectedByDefault: boolean }>,
  selectedSkillIds: string[],
  selectedSkillNames: string[] = [],
  coreSkills: string[] = []
): string[] {
  const byId = new Map(pool.map((p) => [p.id, p]));

  const chosen: string[] = [];
  const chosenLower = new Set<string>();

  for (const raw of selectedSkillNames) {
    if (chosen.length >= 5) break;
    const name = raw.trim();
    if (!name || chosenLower.has(name.toLowerCase())) continue;
    if (coreSkills.length > 0 && matchesCore(name, coreSkills)) continue;
    chosen.push(name);
    chosenLower.add(name.toLowerCase());
  }

  // Ids describe the same picks the names do — resolve them only when no names came.
  if (selectedSkillNames.length === 0) {
    for (const id of selectedSkillIds) {
      if (chosen.length >= 5) break;
      const match = byId.get(id);
      if (match && !chosenLower.has(match.name.toLowerCase())) {
        chosen.push(match.name);
        chosenLower.add(match.name.toLowerCase());
      }
    }
  }

  // Backfill skips core matches too: the pool arrives core-excluded from
  // fetchFocusSkillPool, but only under the same near-duplicate threshold — keep the
  // guarantee local instead of relying on the caller's exclusion.
  for (const p of pool) {
    if (chosen.length >= 5) break;
    if (!p.selectedByDefault) continue;
    if (chosenLower.has(p.name.toLowerCase())) continue;
    if (coreSkills.length > 0 && matchesCore(p.name, coreSkills)) continue;
    chosen.push(p.name);
    chosenLower.add(p.name.toLowerCase());
  }

  for (const p of pool) {
    if (chosen.length >= 5) break;
    if (chosenLower.has(p.name.toLowerCase())) continue;
    if (coreSkills.length > 0 && matchesCore(p.name, coreSkills)) continue;
    chosen.push(p.name);
    chosenLower.add(p.name.toLowerCase());
  }

  return chosen;
}
