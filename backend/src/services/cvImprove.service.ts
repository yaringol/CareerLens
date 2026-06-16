export interface Occurrence {
  sectionId: string;
  text: string;
  jaccardScore: number;
}

export interface SkillContext {
  skill: string;
  score: number;
  found: boolean;
  occurrences: Occurrence[];
  primaryOccurrence: Occurrence | null;
  sharedWith: string[];
}

export interface PrepareResult {
  skills: SkillContext[];
}

export interface MergeGroup {
  sectionId: string;
  originalText: string;
  skills: string[];
  improvements: Array<{ skill: string; proficiency: string; finalText: string }>;
}

export interface MergeInput {
  originalCvText: string;
  jobTitle: string;
  improvements: Array<{
    skill: string;
    proficiency: string;
    sectionId: string | null;
    originalText: string | null;
    finalText: string;
    found: boolean;
  }>;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function splitParagraphs(cvText: string): Array<{ sectionId: string; text: string }> {
  const lines = cvText.split('\n');
  const paragraphs: Array<{ sectionId: string; text: string }> = [];
  let sectionIndex = 0;
  let paraIndex = 0;
  let currentPara: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (currentPara.length > 0) {
        paragraphs.push({
          sectionId: `s${sectionIndex}_p${paraIndex}`,
          text: currentPara.join(' ').trim(),
        });
        paraIndex++;
        currentPara = [];
      }
    } else {
      // Detect section headers (all caps or short lines ending with colon)
      const isHeader =
        (trimmed === trimmed.toUpperCase() && trimmed.length < 40 && /[A-Z]/.test(trimmed)) ||
        (trimmed.endsWith(':') && trimmed.length < 40);
      if (isHeader && currentPara.length > 0) {
        paragraphs.push({
          sectionId: `s${sectionIndex}_p${paraIndex}`,
          text: currentPara.join(' ').trim(),
        });
        sectionIndex++;
        paraIndex = 0;
        currentPara = [];
      }
      currentPara.push(trimmed);
    }
  }

  if (currentPara.length > 0) {
    paragraphs.push({
      sectionId: `s${sectionIndex}_p${paraIndex}`,
      text: currentPara.join(' ').trim(),
    });
  }

  return paragraphs.filter((p) => p.text.length > 10);
}

// Short tokens (2 chars) that Jaccard misses — also check these as exact substrings
function skillTokensIncludingShort(skill: string): Set<string> {
  return new Set(
    skill
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2)
  );
}

// A paragraph matches a skill if ANY of the skill's tokens appear in the paragraph
function paragraphMatchesSkill(skillTokensAll: Set<string>, paraText: string): boolean {
  const paraLower = paraText.toLowerCase();
  for (const tok of skillTokensAll) {
    // word-boundary match to avoid false positives (e.g. "go" inside "going")
    const re = new RegExp(`(?<![a-z0-9])${tok}(?![a-z0-9])`, 'i');
    if (re.test(paraLower)) return true;
  }
  return false;
}

export function extractContext(
  cvText: string,
  weakSkills: Array<{ skill: string; score: number }>
): PrepareResult {
  const paragraphs = splitParagraphs(cvText);

  const skillContexts: SkillContext[] = weakSkills.map(({ skill, score }) => {
    const skillTokens = tokenize(skill);           // length > 2 only (for Jaccard ranking)
    const skillTokensAll = skillTokensIncludingShort(skill); // length >= 2 (for detection)
    const occurrences: Occurrence[] = [];

    for (const para of paragraphs) {
      if (!paragraphMatchesSkill(skillTokensAll, para.text)) continue;
      const paraTokens = tokenize(para.text);
      const jaccardScore = skillTokens.size > 0 ? jaccard(skillTokens, paraTokens) : 0.01;
      occurrences.push({ sectionId: para.sectionId, text: para.text, jaccardScore });
    }

    occurrences.sort((a, b) => b.jaccardScore - a.jaccardScore);

    return {
      skill,
      score,
      found: occurrences.length > 0,
      occurrences,
      primaryOccurrence: occurrences[0] ?? null,
      sharedWith: [],
    };
  });

  // Detect shared sectionIds across skills
  const sectionToSkills = new Map<string, string[]>();
  for (const ctx of skillContexts) {
    if (ctx.primaryOccurrence) {
      const sid = ctx.primaryOccurrence.sectionId;
      const existing = sectionToSkills.get(sid) ?? [];
      existing.push(ctx.skill);
      sectionToSkills.set(sid, existing);
    }
  }

  for (const ctx of skillContexts) {
    if (ctx.primaryOccurrence) {
      const sid = ctx.primaryOccurrence.sectionId;
      const shared = sectionToSkills.get(sid) ?? [];
      ctx.sharedWith = shared.filter((s) => s !== ctx.skill);
    }
  }

  return { skills: skillContexts };
}

export function groupForMerge(input: MergeInput): {
  sectionGroups: MergeGroup[];
  newAdditions: Array<{ skill: string; finalText: string }>;
} {
  const sectionGroups = new Map<string, MergeGroup>();
  const newAdditions: Array<{ skill: string; finalText: string }> = [];

  for (const imp of input.improvements) {
    if (!imp.found || !imp.sectionId || !imp.originalText) {
      if (imp.finalText.trim()) {
        newAdditions.push({ skill: imp.skill, finalText: imp.finalText });
      }
      continue;
    }

    const existing = sectionGroups.get(imp.sectionId);
    if (existing) {
      existing.skills.push(imp.skill);
      existing.improvements.push({ skill: imp.skill, proficiency: imp.proficiency, finalText: imp.finalText });
    } else {
      sectionGroups.set(imp.sectionId, {
        sectionId: imp.sectionId,
        originalText: imp.originalText,
        skills: [imp.skill],
        improvements: [{ skill: imp.skill, proficiency: imp.proficiency, finalText: imp.finalText }],
      });
    }
  }

  return { sectionGroups: Array.from(sectionGroups.values()), newAdditions };
}
