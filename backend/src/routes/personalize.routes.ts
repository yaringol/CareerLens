import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { getCoreSkills, getSkillsFromText, isRoleDataLimited } from '../services/dsModel';
import { isGibberish } from '../utils/gibberishDetector';
import { looksLikeJobUrl } from '../utils/jobUrl';
import { fetchJobPostingFromUrl } from '../services/jobPostingFetcher.service';
import { buildSkillOptions, fetchFocusSkillPool, DEFAULT_SELECTED_COUNT } from '../services/focusSkillPool.service';
import { User } from '../models/user.model';

const router = Router();
router.use(authenticate);

export type { SkillSource, SkillOption } from '../services/focusSkillPool.service';

const MIN_JOB_DESCRIPTION_CHARS = 40;

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

      focusSkillsPromise = getCoreSkills(canonicalTitle.trim(), 0.0, DEFAULT_SELECTED_COUNT)
        .catch(() => null)
        .then((core) => fetchFocusSkillPool(canonicalTitle.trim(), description, core ?? []))
        .then((pool) => pool.map((skill) => skill.name));
    }

    const roleDataLimitedPromise = isRoleDataLimited(canonicalTitle.trim());
    const [focusSkills, cvSkills] = await Promise.all([
      focusSkillsPromise,
      cvSkillsPromise,
    ]);

    // The role was detected and user-confirmed on the upload screen; a fresh
    // detection here (which ran without headerText) could disagree and made
    // this screen display a different role than the one being scored.
    const detectedTitle = canonicalTitle.trim();
    const extractedCvSkills = cvSkills ?? [];
    const roleDerivedSkills = buildSkillOptions(focusSkills ?? []);

    const roleDataLimited = await roleDataLimitedPromise;
    res.json({ detectedTitle, extractedCvSkills, roleDerivedSkills, roleDataLimited });
  } catch (err) {
    next(err);
  }
});

const PREFERENCE_MODES = ['stable', 'balanced', 'trending', 'custom'] as const;

/**
 * GET /api/personalize/preference
 *
 * Returns the signed-in user's saved Recommendation Balance ({ mode, stable, trending,
 * personalMatch }), or null if they've never saved one. The stable/trending scalar the
 * model filters on is recomputed from these weights at analyze time, not stored here.
 */
router.get('/preference', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('personalizationPreference').lean();
    res.json({ preference: user?.personalizationPreference ?? null });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/personalize/preference
 *
 * Persists the full Recommendation Balance (mode + the 3 weights) to the User collection
 * so the Personalization screen can be restored exactly on future runs.
 */
router.put('/preference', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { mode, weights } = req.body as {
      mode?: unknown;
      weights?: { stable?: unknown; trending?: unknown; personalMatch?: unknown };
    };
    if (typeof mode !== 'string' || !PREFERENCE_MODES.includes(mode as (typeof PREFERENCE_MODES)[number])) {
      throw new ValidationError(`mode must be one of: ${PREFERENCE_MODES.join(', ')}`);
    }
    const { stable, trending, personalMatch } = weights ?? {};
    const inRange = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
    if (!inRange(stable) || !inRange(trending) || !inRange(personalMatch)) {
      throw new ValidationError('weights.{stable,trending,personalMatch} must be numbers between 0 and 100');
    }
    if (Math.abs(stable + trending + personalMatch - 100) > 0.5) {
      throw new ValidationError('weights must sum to 100');
    }
    const preference = { mode, stable, trending, personalMatch };
    await User.findByIdAndUpdate(req.user!.id, { personalizationPreference: preference });
    res.json({ preference });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/personalize/preference
 *
 * Clears the saved Recommendation Balance (used when the user turns the save toggle off).
 */
router.delete('/preference', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user!.id, { $unset: { personalizationPreference: '' } });
    res.json({ preference: null });
  } catch (err) {
    next(err);
  }
});

export default router;
