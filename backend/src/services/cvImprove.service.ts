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

// The section headings CVs actually use. Needed because the two structural
// signals we had - ALL CAPS and a trailing colon - both miss the most common
// form by far: a short Title Case line ("Professional Summary", "Experience").
// Matched against the WHITESPACE-FREE form of a line, so a single pattern covers
// "Professional Summary", "ProfessionalSummary" and the letter-spaced
// "P r o f e s s i o n a l  S u m m a r y" that CV templates using
// `letter-spacing` produce - PDF extraction keeps those gaps as real spaces.
const SECTION_HEADING_WORDS =
  /^(?:(?:professional|work|core|key|technical|personal|academic|relevant|additional|other)\s*)?(?:summary|profile|objective|about(?:\s*me)?|experience|employment(?:\s*history)?|history|background|education|skills|competencies|technologies|toolbox|stack|projects?|portfolio|certifications?|certificates?|licen[cs]es?|courses?|training|publications?|patents?|awards?|honou?rs?|achievements?|activities|languages?|volunteering|volunteer(?:\s*work)?|interests|hobbies|references|military(?:\s*service)?)$/i;

function isHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 50) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  const bare = trimmed.replace(/[\s:.–—-]+$/, '');
  return (
    (trimmed === trimmed.toUpperCase() && letters.length >= 3) ||
    /^[A-Za-z][A-Za-z\s&/.-]+:$/.test(trimmed) ||
    SECTION_HEADING_WORDS.test(bare.replace(/\s+/g, ''))
  );
}

// "E x p e r i e n c e" -> "Experience", "M i l i t a r y S e r v i c e" ->
// "Military Service". Display only: the section text keeps what the PDF said.
function tidyHeadingLabel(line: string): string {
  const bare = line.trim().replace(/:$/, '');
  const parts = bare.split(/\s+/);
  if (parts.length >= 4 && parts.every((p) => p.length === 1)) {
    return parts.join('').replace(/(?<=[a-z])(?=[A-Z])/g, ' ');
  }
  return bare;
}

// pdf-parse emits a page separator ("-- 1 of 1 --") into the extracted text.
// Left in, it becomes a section of its own and lands in the exported CV.
function isPageMarker(line: string): boolean {
  const bare = line.trim().replace(/^[\s–—-]+|[\s–—-]+$/g, '');
  return /^(?:page\s*)?\d+\s*(?:of|\/)\s*\d+$/i.test(bare);
}

function matchKind(haystack: string): CvSection['kind'] | null {
  const h = haystack.toLowerCase();
  if (/\b(skill|skills|technologies|toolbox)\b/.test(h)) return 'skills';
  if (/\b(experience|employment|work history|professional experience)\b/.test(h)) return 'experience';
  if (/\b(education|degree|university|college)\b/.test(h)) return 'education';
  if (/\b(project|projects|portfolio)\b/.test(h)) return 'projects';
  if (/\b(summary|profile|objective|about)\b/.test(h)) return 'summary';
  return null;
}

// The heading wins over the body. Matching both together lets ordinary prose
// decide the kind - a summary that says "five years of experience" classified
// as 'experience', and one that lists skills as 'skills', which then makes it
// the target section for skills being ADDED to the CV.
function inferKind(label: string, text: string): CvSection['kind'] {
  return matchKind(label) ?? matchKind(text) ?? 'other';
}

function labelForBlock(text: string, order: number): string {
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean);
  if (firstLine && isHeading(firstLine)) {
    return tidyHeadingLabel(firstLine);
  }
  // The block above the first heading is the name/contact block in every CV layout.
  if (order === 0) return 'Header';
  return `Section ${order + 1}`;
}

export function splitCvIntoSections(cvText: string): CvSection[] {
  const normalized = cvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // Blank lines alone cannot carry this split: PDF text extraction returns one
  // line per rendered row and almost never a blank line between sections, so
  // splitting on blank lines collapses the entire CV into a single section - and
  // then every weak skill points at the whole document instead of the paragraph
  // that mentions it. Headings are the boundary that actually exists in the text.
  const blocks: string[] = [];
  let current: string[] = [];
  let currentHasBody = false;   // a heading on its own is not yet a section
  const flush = () => {
    const text = current.join('\n').trim();
    if (text) blocks.push(text);
    current = [];
    currentHasBody = false;
  };

  for (const line of normalized.split('\n')) {
    if (isPageMarker(line)) continue;
    if (!line.trim()) {
      // Whitespace under a heading is layout, not a boundary. Flushing on it
      // would strand the heading in a section of its own and leave its body
      // in an unlabelled one.
      if (currentHasBody) flush();
      continue;
    }
    if (isHeading(line)) {
      if (currentHasBody) flush();
      current.push(line);
      continue;
    }
    current.push(line);
    currentHasBody = true;
  }
  flush();

  if (blocks.length === 0) blocks.push(normalized);

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
