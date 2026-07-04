import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { extractTitleFromCv, getSkillsFromText } from '../services/dsModel';
import { extractDynamicSkills } from '../services/job.service';
import { isGibberish } from '../utils/gibberishDetector';
import { looksLikeJobUrl } from '../utils/jobUrl';
import { fetchJobPostingFromUrl } from '../services/jobPostingFetcher.service';

const router = Router();
router.use(authenticate);

export type SkillSource = 'cv' | 'role' | 'market';

export interface SkillOption {
  id: string;
  name: string;
  source: SkillSource;
  score: number;
  selectedByDefault: boolean;
}

const ROLE_SKILL_POOL_SIZE = 10;
const DEFAULT_SELECTED_COUNT = 5;
const MIN_JOB_DESCRIPTION_CHARS = 40;

function skillId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build the focus-skill candidate pool for the Personalization screen.
 *
 * The pool is derived from the same posting-aware dynamic signals used by
 * standard analysis: trending market skills first, then LLM/fallback skills
 * extracted from the job posting. The top DEFAULT_SELECTED_COUNT are pre-selected.
 */
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

function buildSkillOptions(skills: string[], excludedCoreSkills: string[] = []): SkillOption[] {
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

async function resolveJobDescriptionInput(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!looksLikeJobUrl(trimmed)) return trimmed;
  const fetched = await fetchJobPostingFromUrl(trimmed);
  return fetched.description.trim();
}

/**
 * POST /api/personalize/options
 *
 * Feeds the Personalization screen with the detected title, the user's
 * CV-extracted skills, and a posting-derived focus-skill pool. In CV-only mode
 * there is no job posting, so no dynamic focus skills are returned.
 */
router.post('/options', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { canonicalTitle, cvText, jobDescription, isPostingMode } = req.body as {
      canonicalTitle?: unknown;
      cvText?: unknown;
      jobDescription?: unknown;
      isPostingMode?: unknown;
    };

    if (typeof canonicalTitle !== 'string' || !canonicalTitle.trim()) {
      throw new ValidationError('canonicalTitle is required');
    }
    if (typeof cvText !== 'string' || cvText.trim().length < 10) {
      throw new ValidationError('cvText is required (min 10 chars)');
    }

    const postingMode = isPostingMode === true || (
      isPostingMode !== false &&
      typeof jobDescription === 'string' &&
      jobDescription.trim().length > 0
    );

    const titlePromise = extractTitleFromCv(cvText).catch(() => null);
    const cvSkillsPromise = getSkillsFromText(cvText, 15).catch(() => [] as string[]);
    let focusSkillsPromise: Promise<string[]> = Promise.resolve([]);

    if (postingMode) {
      const rawDescription = typeof jobDescription === 'string' ? jobDescription.trim() : '';
      if (!rawDescription) {
        throw new ValidationError('jobDescription is required for focus skills');
      }
      const description = await resolveJobDescriptionInput(rawDescription);
      if (description.length < MIN_JOB_DESCRIPTION_CHARS) {
        throw new ValidationError(
          `jobDescription is required (at least ${MIN_JOB_DESCRIPTION_CHARS} characters)`
        );
      }
      if (isGibberish(description)) {
        res.status(400).json({
          code: 'GIBBERISH_DETECTED',
          error: 'The job description does not look like readable English.',
        });
        return;
      }

      focusSkillsPromise = extractDynamicSkills(canonicalTitle.trim(), description, ROLE_SKILL_POOL_SIZE)
        .then((result) => buildSkillOptions(result.extractedSkills).map((skill) => skill.name));
    }

    const [titleResult, focusSkills, cvSkills] = await Promise.all([
      titlePromise,
      focusSkillsPromise,
      cvSkillsPromise,
    ]);

    const detectedTitle =
      titleResult?.canonical_title || titleResult?.extracted_title || canonicalTitle.trim();
    const extractedCvSkills = cvSkills ?? [];
    const roleDerivedSkills = buildSkillOptions(focusSkills ?? []);

    res.json({ detectedTitle, extractedCvSkills, roleDerivedSkills });
  } catch (err) {
    next(err);
  }
});

export default router;
