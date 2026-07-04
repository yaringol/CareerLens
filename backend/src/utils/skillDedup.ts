/** Jaccard threshold for treating two skill labels as the same concept (e.g. "Node.js" vs "node js"). */
export const NEAR_DUP_THRESHOLD = 0.5;

export function skillTokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

export function jaccardTokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function areNearDuplicateSkills(
  a: string,
  b: string,
  threshold = NEAR_DUP_THRESHOLD
): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return true;
  if (left.toLowerCase() === right.toLowerCase()) return true;

  const ta = skillTokenSet(left);
  const tb = skillTokenSet(right);
  if (ta.size === 0 || tb.size === 0) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return jaccardTokenSimilarity(ta, tb) >= threshold;
}

export function isNearDuplicateOfAny(
  skill: string,
  existing: string[],
  threshold = NEAR_DUP_THRESHOLD
): boolean {
  return existing.some((item) => areNearDuplicateSkills(skill, item, threshold));
}

/** Merge skill labels in order, dropping exact and near-duplicates. */
export function dedupeSkills(raw: string[], maxCount?: number): string[] {
  const seenExact = new Set<string>();
  const ordered: string[] = [];

  for (const item of raw) {
    const name = item.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seenExact.has(key)) continue;
    if (isNearDuplicateOfAny(name, ordered)) continue;

    seenExact.add(key);
    ordered.push(name);
    if (maxCount !== undefined && ordered.length >= maxCount) break;
  }

  return ordered;
}
