export interface Occurrence {
  sectionId: string;
  text: string;
  jaccardScore: number;
}

export interface CvSection {
  sectionId: string;
  label: string;
  originalText: string;
  currentText: string;
  order: number;
  kind: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';
  version: number;
}

export interface SkillContext {
  skill: string;
  score: number;
  found: boolean;
  occurrences: Occurrence[];
  primaryOccurrence: Occurrence | null;
  sharedWith: string[];
  targetSectionId: string | null;
}

export interface PrepareResult {
  sections: CvSection[];
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

export interface SectionComposeInput {
  sections: CvSection[];
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

function stableSectionId(order: number): string {
  return `sec_${String(order).padStart(3, '0')}`;
}

function isHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 50) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  return (
    (trimmed === trimmed.toUpperCase() && letters.length >= 3) ||
    /^[A-Za-z][A-Za-z\s&/.-]+:$/.test(trimmed)
  );
}

function inferKind(label: string, text: string): CvSection['kind'] {
  const haystack = `${label}\n${text}`.toLowerCase();
  if (/\b(skill|skills|technologies|toolbox)\b/.test(haystack)) return 'skills';
  if (/\b(experience|employment|work history|professional experience)\b/.test(haystack)) return 'experience';
  if (/\b(education|degree|university|college)\b/.test(haystack)) return 'education';
  if (/\b(project|projects|portfolio)\b/.test(haystack)) return 'projects';
  if (/\b(summary|profile|objective|about)\b/.test(haystack)) return 'summary';
  return 'other';
}

function labelForBlock(text: string, order: number): string {
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean);
  if (firstLine && isHeading(firstLine)) {
    return firstLine.replace(/:$/, '');
  }
  return `Section ${order + 1}`;
}

export function splitCvIntoSections(cvText: string): CvSection[] {
  const normalized = cvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const rawBlocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const blocks = rawBlocks.length > 0 ? rawBlocks : [normalized];

  return blocks.map((text, order) => {
    const label = labelForBlock(text, order);
    return {
      sectionId: stableSectionId(order),
      label,
      originalText: text,
      currentText: text,
      order,
      kind: inferKind(label, text),
      version: 0,
    };
  });
}

function pickDefaultSectionId(sections: CvSection[]): string | null {
  return (
    sections.find((section) => section.kind === 'skills')?.sectionId ??
    sections.find((section) => section.kind === 'summary')?.sectionId ??
    sections[0]?.sectionId ??
    null
  );
}

function sortSections(sections: CvSection[]): CvSection[] {
  return [...sections].sort((a, b) => a.order - b.order);
}

export function composeCvFromSections(input: SectionComposeInput): string {
  return sortSections(input.sections)
    .map((section) => section.currentText.trim())
    .filter(Boolean)
    .join('\n\n');
}

function splitParagraphs(cvText: string): Array<{ sectionId: string; text: string }> {
  const sections = splitCvIntoSections(cvText);
  const paragraphs: Array<{ sectionId: string; text: string }> = [];

  for (const section of sections) {
    paragraphs.push({
      sectionId: section.sectionId,
      text: section.originalText,
    });
  }

  return paragraphs.filter((p) => p.text.length > 10);
}

// Short tokens (2 chars) that Jaccard misses - also check these as exact substrings
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
  const sections = splitCvIntoSections(cvText);
  const paragraphs = sections.map((section) => ({
    sectionId: section.sectionId,
    text: section.originalText,
  }));
  const defaultSectionId = pickDefaultSectionId(sections);

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
      targetSectionId: occurrences[0]?.sectionId ?? defaultSectionId,
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

  return { sections, skills: skillContexts };
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
