import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { extractTitleFromCv, getSkillsFromText, getCoreSkills } from '../services/dsModel';
import { skillId } from '../services/personalization.service';

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

/**
 * Build the focus-skill candidate pool for the Personalization screen.
 *
 * The pool is derived ONLY from the role/job itself (deterministic top-N skills
 * for the canonical title), so the user picks from job-relevant skills. CV- and
 * posting-derived skills are intentionally excluded here: they are a product of
 * the personalization the user is about to configure and are not known yet.
 * The top DEFAULT_SELECTED_COUNT are pre-selected.
 */
function buildSkillOptions(roleSkills: string[]): SkillOption[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of roleSkills) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    ordered.push(name);
  }

  const total = ordered.length || 1;
  return ordered.map((name, i) => ({
    id: skillId(name) || `skill-${i}`,
    name,
    source: 'role' as SkillSource,
    score: Number((1 - i / total).toFixed(2)),
    selectedByDefault: i < DEFAULT_SELECTED_COUNT,
  }));
}

/**
 * POST /api/personalize/options
 *
 * Feeds the Personalization screen with the detected title, the user's
 * CV-extracted skills, and a role-derived focus-skill pool (top
 * ROLE_SKILL_POOL_SIZE for the role, top 5 pre-selected).
 * jobDescription is accepted now so the contract is ready to derive skills from
 * the posting later; it is not used to build the focus pool today.
 */
router.post('/options', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { canonicalTitle, cvText } = req.body as {
      canonicalTitle?: unknown;
      cvText?: unknown;
      jobDescription?: unknown;
    };

    if (typeof canonicalTitle !== 'string' || !canonicalTitle.trim()) {
      throw new ValidationError('canonicalTitle is required');
    }
    if (typeof cvText !== 'string' || cvText.trim().length < 10) {
      throw new ValidationError('cvText is required (min 10 chars)');
    }

    const [titleResult, roleSkills, cvSkills] = await Promise.all([
      extractTitleFromCv(cvText).catch(() => null),
      getCoreSkills(canonicalTitle.trim(), 0.0, ROLE_SKILL_POOL_SIZE).catch(() => null),
      getSkillsFromText(cvText, 15).catch(() => [] as string[]),
    ]);

    const detectedTitle =
      titleResult?.canonical_title || titleResult?.extracted_title || canonicalTitle.trim();
    const extractedCvSkills = cvSkills ?? [];
    const roleDerivedSkills = buildSkillOptions(roleSkills ?? []);

    res.json({ detectedTitle, extractedCvSkills, roleDerivedSkills });
  } catch (err) {
    next(err);
  }
});

export default router;
