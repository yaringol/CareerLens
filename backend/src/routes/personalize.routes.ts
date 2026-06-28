import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { extractTitleFromCv, getSkillsFromText, getCoreSkills } from '../services/dsModel';

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

function skillId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build the focus-skill candidate pool for the Personalization screen.
 * Role core skills rank highest (and are pre-selected), then job-posting skills,
 * then CV-extracted skills — deduped case-insensitively. Only EXISTING DS model
 * capabilities are used; no time-based/personalized logic here.
 */
function buildSkillOptions(
  roleSkills: string[],
  marketSkills: string[],
  cvSkills: string[]
): SkillOption[] {
  const buckets: Array<{ names: string[]; source: SkillSource }> = [
    { names: roleSkills, source: 'role' },
    { names: marketSkills, source: 'market' },
    { names: cvSkills, source: 'cv' },
  ];

  const seen = new Set<string>();
  const ordered: Array<{ name: string; source: SkillSource }> = [];
  for (const { names, source } of buckets) {
    for (const raw of names) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      ordered.push({ name, source });
    }
  }

  const total = ordered.length || 1;
  return ordered.map((item, i) => ({
    id: skillId(item.name) || `skill-${i}`,
    name: item.name,
    source: item.source,
    score: Number((1 - i / total).toFixed(2)),
    selectedByDefault: i < 5,
  }));
}

/**
 * POST /api/personalize/options
 *
 * Feeds the Personalization screen with the detected title, the user's
 * CV-extracted skills, and a role-derived focus-skill pool (top 5 pre-selected).
 * jobDescription is accepted now so the contract is ready to derive skills from
 * the posting later; today it only enriches the candidate pool when provided.
 */
router.post('/options', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { canonicalTitle, cvText, jobDescription } = req.body as {
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
    const jd = typeof jobDescription === 'string' ? jobDescription.trim() : '';

    const [titleResult, roleSkills, cvSkills, marketSkills] = await Promise.all([
      extractTitleFromCv(cvText).catch(() => null),
      getCoreSkills(canonicalTitle.trim()).catch(() => null),
      getSkillsFromText(cvText, 15).catch(() => [] as string[]),
      jd.length >= 40 ? getSkillsFromText(jd, 10).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    ]);

    const detectedTitle =
      titleResult?.canonical_title || titleResult?.extracted_title || canonicalTitle.trim();
    const extractedCvSkills = cvSkills ?? [];
    const roleDerivedSkills = buildSkillOptions(roleSkills ?? [], marketSkills ?? [], extractedCvSkills);

    res.json({ detectedTitle, extractedCvSkills, roleDerivedSkills });
  } catch (err) {
    next(err);
  }
});

export default router;
