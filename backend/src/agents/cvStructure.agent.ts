import { llmCall } from '../infra/llm/llmCall';
import { parseJsonSafe } from '../infra/llm/parseJson';
import { AgentError } from './agentError';

const AGENT_NAME = 'cvStructure';

// Structuring a full CV into JSON produces far more output than the default
// 500-token budget; a truncated object here fails the whole PDF export.
const STRUCTURE_MAX_TOKENS = 3000;
const STRUCTURE_TIMEOUT_MS = 45000;

export interface StructuredCvContact {
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface StructuredCvExperience {
  title: string;
  company?: string;
  location?: string;
  dates?: string;
  bullets: string[];
}

export interface StructuredCvEducation {
  degree: string;
  institution?: string;
  dates?: string;
  details: string[];
}

export interface StructuredCvProject {
  name: string;
  dates?: string;
  bullets: string[];
}

export interface StructuredCvSkillGroup {
  category?: string;
  items: string[];
}

export interface StructuredCvExtraSection {
  label: string;
  items: string[];
}

/**
 * The typed layout contract between the structuring agent and the PDF
 * template. Keep in sync with frontend/src/pdf/cvPdfTypes.ts.
 */
export interface StructuredCv {
  name: string;
  headline?: string;
  contact: StructuredCvContact;
  summary?: string;
  skills: StructuredCvSkillGroup[];
  experience: StructuredCvExperience[];
  education: StructuredCvEducation[];
  projects: StructuredCvProject[];
  certifications: string[];
  languages: string[];
  extras: StructuredCvExtraSection[];
}

const SYSTEM_PROMPT = `You are a CV layout analyst. You convert the plain text of a CV into a structured JSON object that a design template will render as a polished PDF.

You are an ORGANIZER, not a writer:
- Every piece of information in the CV text must appear somewhere in the JSON. Never drop content - not even text that looks garbled, misplaced, or like a typo. If a line contains stray characters (e.g. "xxxCore Skills"), carry the stray text through verbatim rather than cleaning it away.
- Never invent, embellish, or rewrite content. Copy the candidate's wording verbatim; you may only trim leading bullet characters (•, -, *) and fix stray whitespace.
- Never fabricate contact details, dates, employers, or skills that are not in the text.
- A skills section may contain full descriptive sentences (e.g. "Basic familiarity with React in collaborative settings.") in addition to skill names - keep each such sentence as its own item in that group's "items"; do not drop, merge, or shorten them.

Return ONLY a JSON object with this exact shape (omit optional string fields you cannot fill; keep empty arrays for sections the CV does not have):
{
  "name": "candidate full name",
  "headline": "professional title, e.g. 'DevOps Engineer' (optional)",
  "contact": { "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": "" },
  "summary": "the summary/profile/objective paragraph (optional)",
  "skills": [ { "category": "group name if the CV groups skills (optional)", "items": ["skill", ...] } ],
  "experience": [ { "title": "role title", "company": "", "location": "", "dates": "", "bullets": ["achievement or responsibility", ...] } ],
  "education": [ { "degree": "", "institution": "", "dates": "", "details": ["extra line", ...] } ],
  "projects": [ { "name": "", "dates": "", "bullets": ["", ...] } ],
  "certifications": ["", ...],
  "languages": ["English (fluent)", ...],
  "extras": [ { "label": "section heading, e.g. 'Military Service' or 'Volunteering'", "items": ["", ...] } ]
}

Parsing rules:
- Split experience prose into concise bullets at sentence or clause boundaries WITHOUT changing the words themselves.
- Skills listed as comma/pipe-separated text become individual items.
- "linkedin"/"github"/"website" hold the URL or handle exactly as written.
- Any section that fits none of the named groups (awards, publications, hobbies, military service, volunteering...) goes to "extras" with its heading as "label".
- Output discipline: return ONLY valid JSON - no explanation, no markdown fences.`;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function cleanContact(value: unknown): StructuredCvContact {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  return {
    email: cleanString(raw.email),
    phone: cleanString(raw.phone),
    location: cleanString(raw.location),
    linkedin: cleanString(raw.linkedin),
    github: cleanString(raw.github),
    website: cleanString(raw.website),
  };
}

function cleanObjectArray<T>(value: unknown, map: (raw: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const mapped = map(item as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * The LLM output is untrusted: coerce every field to the declared shape so the
 * PDF template never meets a missing array or a non-string bullet.
 */
function normalize(parsed: Record<string, unknown>, cvText: string): StructuredCv {
  const fallbackName = cvText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? 'Candidate';

  return {
    name: cleanString(parsed.name) ?? fallbackName,
    headline: cleanString(parsed.headline),
    contact: cleanContact(parsed.contact),
    summary: cleanString(parsed.summary),
    skills: cleanObjectArray<StructuredCvSkillGroup>(parsed.skills, (raw) => {
      const items = cleanStringArray(raw.items);
      return items.length ? { category: cleanString(raw.category), items } : null;
    }),
    experience: cleanObjectArray<StructuredCvExperience>(parsed.experience, (raw) => {
      const title = cleanString(raw.title);
      if (!title) return null;
      return {
        title,
        company: cleanString(raw.company),
        location: cleanString(raw.location),
        dates: cleanString(raw.dates),
        bullets: cleanStringArray(raw.bullets),
      };
    }),
    education: cleanObjectArray<StructuredCvEducation>(parsed.education, (raw) => {
      const degree = cleanString(raw.degree);
      if (!degree) return null;
      return {
        degree,
        institution: cleanString(raw.institution),
        dates: cleanString(raw.dates),
        details: cleanStringArray(raw.details),
      };
    }),
    projects: cleanObjectArray<StructuredCvProject>(parsed.projects, (raw) => {
      const name = cleanString(raw.name);
      if (!name) return null;
      return { name, dates: cleanString(raw.dates), bullets: cleanStringArray(raw.bullets) };
    }),
    certifications: cleanStringArray(parsed.certifications),
    languages: cleanStringArray(parsed.languages),
    extras: cleanObjectArray<StructuredCvExtraSection>(parsed.extras, (raw) => {
      const label = cleanString(raw.label);
      const items = cleanStringArray(raw.items);
      return label && items.length ? { label, items } : null;
    }),
  };
}

/** Convert improved CV plain text into the typed layout the PDF template renders. */
export async function structureCv(cvText: string, jobTitle?: string): Promise<StructuredCv> {
  const targetLine = jobTitle ? `Target job title (context only, do NOT inject it into the CV): ${jobTitle}\n\n` : '';

  const raw = await llmCall(
    AGENT_NAME,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${targetLine}CV text:\n${cvText}` },
    ],
    { maxTokens: STRUCTURE_MAX_TOKENS, timeoutMs: STRUCTURE_TIMEOUT_MS }
  );

  const parsed = await parseJsonSafe<Record<string, unknown>>(raw, AGENT_NAME);
  const structured = normalize(parsed, cvText);

  const hasBody =
    structured.summary ||
    structured.skills.length ||
    structured.experience.length ||
    structured.education.length ||
    structured.projects.length ||
    structured.extras.length;
  if (!hasBody) {
    throw new AgentError(AGENT_NAME, 'Structured CV came back empty - no sections were recognized');
  }

  return structured;
}
