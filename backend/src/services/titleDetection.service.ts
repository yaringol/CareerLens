export interface DetectedCvTitle {
  detectedTitle: string | null;
  confidence: number;
  source: 'headline' | 'experience' | 'none';
}

const TITLE_WORD =
  '(?:engineer|developer|scientist|manager|analyst|designer|architect|administrator|consultant|specialist|researcher)';
const TITLE_QUALIFIER = '(?:senior|junior|lead|principal|staff|associate|graduate|intern)';
const TITLE_DOMAIN =
  '(?:application|back[ -]?end|bi|business intelligence|cloud|data(?: science)?|devops|front[ -]?end|full[ -]?stack|machine learning|mobile|network|platform|product|qa|quality assurance|react|research|security|site reliability|software|systems|ui|ux|web)';
const TITLE_PATTERN = new RegExp(
  `\\b((?:(?:${TITLE_QUALIFIER})\\s+){0,3}(?:(?:${TITLE_DOMAIN})\\s+)?${TITLE_WORD})\\b`,
  'i'
);
const LABELED_TITLE_PATTERN = /^(?:current\s+)?(?:job\s+)?(?:title|role|position|headline)\s*[:\-]\s*(.+)$/i;
const SECTION_PATTERN = /^(?:professional\s+)?(?:summary|profile|experience|work\s+experience|employment|education|skills|projects|certifications?)\s*:?$/i;
const MAX_SCAN_LINES = 80;
const HEADLINE_LINES = 18;

function normalizeLine(line: string): string {
  return line
    .replace(/[|•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
}

function extractTitle(text: string): string | null {
  const candidate = normalizeLine(text).replace(/[.,;:]+$/, '');
  const match = candidate.match(TITLE_PATTERN);
  if (!match) return null;

  const title = match[1].replace(/\s+/g, ' ').trim();
  return title.length <= 80 ? title : null;
}

/**
 * Finds an explicit job title in CV text without depending on an LLM.
 * Mapping the detected free-text title to a supported model title is handled separately.
 */
export function detectTitleFromCv(cvText: string): DetectedCvTitle {
  const lines = cvText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, MAX_SCAN_LINES);
  let inExperience = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (SECTION_PATTERN.test(line)) {
      inExperience = /^(?:work\s+)?experience|employment$/i.test(line.replace(/:$/, ''));
      continue;
    }

    const labeledTitle = line.match(LABELED_TITLE_PATTERN);
    const explicitTitle = labeledTitle ? extractTitle(labeledTitle[1]) : extractTitle(line);
    if (!explicitTitle) continue;

    const isHeadline = !inExperience && index < HEADLINE_LINES;
    return {
      detectedTitle: explicitTitle,
      confidence: labeledTitle ? 0.95 : isHeadline ? 0.82 : 0.68,
      source: isHeadline ? 'headline' : 'experience',
    };
  }

  return { detectedTitle: null, confidence: 0, source: 'none' };
}
