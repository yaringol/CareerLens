import { Router, Request, Response, NextFunction } from 'express';
import {
  validateJobTitle,
  validateJobById,
  getCoreSkillsById,
  extractDynamicSkills,
} from '../services/job.service';
import { getSkillsFromText, getTrendingSkills } from '../services/dsModel';
import { scoreAndPersist } from '../services/scoring.service';
import { ValidationError } from '../errors';
import type { IJob } from '../models/job.model';
import { logAnalyzeOk } from '../utils/logger';
import { isGibberish } from '../utils/gibberishDetector';
import { looksLikeJobUrl } from '../utils/jobUrl';
import { fetchJobPostingFromUrl } from '../services/jobPostingFetcher.service';
import { authenticate } from '../middleware/auth.middleware';
import {
  analyzeWithParallelFavoriteCompare,
  compareAgainstFavoriteCvs,
} from '../services/compareSaved.service';

const router = Router();
router.use(authenticate);

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

/** Drop LLM dynamics that are too close to a fixed core phrase (root cause of “duplicate” skills). */
const NEAR_DUP_THRESHOLD = 0.5;

function isNearDuplicateOfCore(skill: string, core: string[]): boolean {
  const ts = tokenSet(skill);
  if (ts.size === 0) return true;
  for (const c of core) {
    if (jaccardSimilarity(ts, tokenSet(c)) >= NEAR_DUP_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/** Role-specific padding so merged tail is not identical across every job. */
const MERGE_PADDING_BY_TITLE: Record<string, string[]> = {
  'Software Engineer': [
    'Technical writing for engineers',
    'Mentoring junior developers',
    'Vendor and tool evaluation',
    'Capacity and reliability planning',
    'Security review participation',
  ],
  'Data Scientist': [
    'Survey and sampling design',
    'Surveying stakeholder requirements',
    'Literature review for methods',
    'Dashboard maintenance',
    'Ethical data handling',
  ],
  'Product Manager': [
    'Competitive landscape scanning',
    'Pricing and packaging input',
    'Beta program coordination',
    'Customer interview synthesis',
    'Go-to-market alignment',
  ],
  'DevOps Engineer': [
    'Patch and upgrade windows',
    'Backup and restore drills',
    'Service level objectives',
    'Certificate lifecycle management',
    'ChatOps or runbook culture',
  ],
  'Frontend Developer': [
    'Design QA with designers',
    'Localization readiness',
    'Analytics instrumentation hooks',
    'Progressive enhancement mindset',
    'Storybook or component docs',
  ],
};

/**
 * Positions 1–5: canonical core skills. Positions 6–10: dynamics (LLM or fallback), minus near-duplicates of core, then role-specific padding.
 */
export function mergeTenSkills(jobTitle: string, core: string[], dynamic: string[]): string[] {
  const coreFive = core.slice(0, 5);
  if (coreFive.length !== 5) {
    throw new ValidationError('Internal error: expected exactly 5 core skills');
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const s of coreFive) {
    const t = s.trim();
    if (!t || seen.has(t.toLowerCase())) {
      throw new ValidationError('Invalid core skills: duplicates or empty entries');
    }
    seen.add(t.toLowerCase());
    out.push(t);
  }

  for (const d of dynamic) {
    if (out.length >= 10) break;
    const t = d.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    if (isNearDuplicateOfCore(t, coreFive)) {
      continue;
    }
    seen.add(t.toLowerCase());
    out.push(t);
  }

  const pads = MERGE_PADDING_BY_TITLE[jobTitle] ?? [
    'Written communication',
    'Problem solving',
    'Team collaboration',
    'Time management',
    'Attention to detail',
    'Analytical thinking',
    'Customer focus',
    'Presentation skills',
  ];
  for (const p of pads) {
    if (out.length >= 10) break;
    const t = p.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    if (out.length > 5 && isNearDuplicateOfCore(t, coreFive)) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }

  let i = 1;
  while (out.length < 10) {
    const t = `Role-specific competency ${i} (${jobTitle})`;
    if (!seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
    i++;
  }

  return out.slice(0, 10);
}

const MIN_JOB_DESCRIPTION_CHARS = 40;

async function resolveJobDescriptionInput(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!looksLikeJobUrl(trimmed)) return trimmed;
  const fetched = await fetchJobPostingFromUrl(trimmed);
  return fetched.description.trim();
}

/**
 * POST /api/analyze
 *
 * Current: { canonicalTitle, cvText, jobDescription } — a detected or user-confirmed canonical title
 *          selects the role. The stored Job.description is not used for dynamic skill extraction.
 * Also supported: { jobId, cvText, jobDescription } and legacy { jobTitle, jobDescription, cvText }.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, canonicalTitle, cvText, jobTitle, jobDescription, excludeCvId } = req.body as {
      jobId?: string;
      canonicalTitle?: string;
      cvText?: string;
      jobTitle?: string;
      jobDescription?: string;
      excludeCvId?: string;
    };

    let job: IJob;
    let descriptionForDynamic: string;
    const skipGibberish = req.header('X-Skip-Gibberish')?.toLowerCase() === 'true';

    if ((jobId || canonicalTitle) && cvText) {
      job = jobId
        ? await validateJobById(jobId)
        : await validateJobTitle(canonicalTitle!.trim());
      if (skipGibberish) {
        descriptionForDynamic = '';
      } else {
        const jd =
          typeof jobDescription === 'string' ? jobDescription.trim() : '';
        if (!jd) {
          throw new ValidationError(
            'jobDescription is required — paste the job posting text or a link'
          );
        }
        descriptionForDynamic = await resolveJobDescriptionInput(jd);
        if (descriptionForDynamic.length < MIN_JOB_DESCRIPTION_CHARS) {
          throw new ValidationError(
            `jobDescription is required (at least ${MIN_JOB_DESCRIPTION_CHARS} characters) — paste the job posting for skill extraction`
          );
        }
      }
    } else if (jobTitle && jobDescription && cvText) {
      job = await validateJobTitle(jobTitle);
      descriptionForDynamic = jobDescription;
    } else {
      throw new ValidationError(
        'Provide canonicalTitle or jobId with cvText and jobDescription, or jobTitle, jobDescription, and cvText'
      );
    }

    const id = job._id.toString();

    if (!skipGibberish && isGibberish(descriptionForDynamic)) {
      res.status(400).json({
        code: 'GIBBERISH_DETECTED',
        error: 'The job description does not look like readable English.',
      });
      return;
    }

    const { coreSkills } = await getCoreSkillsById(id);

    // Time-aware skills (recency-weighted) fetched before scoring. Best-effort: a DS
    // hiccup must never fail analyze. Trending skills are prepended to the dynamic list
    // so positions 6–10 favour what's currently in demand; each skill's trend is also
    // threaded to the response for display.
    let trending: { skill: string; trend: string }[] = [];
    if (!skipGibberish) {
      try {
        trending = await getTrendingSkills(job.title);
      } catch {
        trending = [];
      }
    }
    const trendBySkill = new Map(trending.map((t) => [t.skill.toLowerCase(), t.trend]));

    const allSkills = skipGibberish
      ? coreSkills.slice(0, 5)
      : mergeTenSkills(job.title, coreSkills, [
          ...trending.map((t) => t.skill),
          ...(await extractDynamicSkills(job.title, descriptionForDynamic)).extractedSkills,
        ]);

    const cvOnlyMode = skipGibberish;
    const expectedSkillCount = cvOnlyMode ? 5 : 10;

    const { analysis, bestSavedCv } = await analyzeWithParallelFavoriteCompare({
      userId: req.user!.id,
      jobId: id,
      jobTitle: job.title,
      cvText: cvText.trim(),
      skills: allSkills,
      cvOnlyMode,
      expectedSkillCount,
      excludeCvId: typeof excludeCvId === 'string' ? excludeCvId : undefined,
      cvFileName: id,
      keywordOnly: cvOnlyMode,
    });

    logAnalyzeOk(job.title);

    res.json({
      jobTitle: analysis.jobTitle,
      skills: analysis.scores.map((s) => ({
        name: s.skill,
        score: s.score,
        trend: trendBySkill.get(s.skill.toLowerCase()) ?? 'stable',
      })),
      matchScore: analysis.matchScore,
      id: analysis._id.toString(),
      cvOnlyMode: analysis.cvOnlyMode ?? false,
      isEstimated: analysis.isEstimated ?? false,
      bestSavedCv,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analyze/skillner
 *
 * Same as POST /api/analyze but uses SkillNer (DS model /text/skills)
 * for dynamic skill extraction instead of the LLM agent.
 *
 * Body: { jobId, cvText } or { jobTitle, jobDescription, cvText }
 */
router.post('/skillner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, cvText, jobTitle, jobDescription } = req.body as {
      jobId?: string;
      cvText?: string;
      jobTitle?: string;
      jobDescription?: string;
    };

    let job: IJob;
    let descriptionForDynamic: string;

    if (jobId && cvText) {
      job = await validateJobById(jobId);
      descriptionForDynamic =
        job.description?.trim() ||
        `${job.title}: professional role requiring strong execution, collaboration, and domain-relevant technical skills.`;
    } else if (jobTitle && jobDescription && cvText) {
      job = await validateJobTitle(jobTitle);
      descriptionForDynamic = jobDescription;
    } else {
      throw new ValidationError(
        'Provide jobId and cvText, or jobTitle, jobDescription, and cvText'
      );
    }

    const id = job._id.toString();

    const [{ coreSkills }, dynamicSkills] = await Promise.all([
      getCoreSkillsById(id),
      getSkillsFromText(descriptionForDynamic),
    ]);

    const allSkills = mergeTenSkills(job.title, coreSkills, dynamicSkills);

    const analysis = await scoreAndPersist({
      userId: req.user!.id,
      jobId: id,
      jobTitle: job.title,
      cvText: cvText!.trim(),
      skills: allSkills,
      cvFileName: id,
    });

    logAnalyzeOk(job.title);

    res.json({
      jobTitle: analysis.jobTitle,
      skills: analysis.scores.map((s) => ({ name: s.skill, score: s.score })),
      matchScore: analysis.matchScore,
      id: analysis._id.toString(),
      extractor: 'skillner',
      isEstimated: analysis.isEstimated ?? false,
    });
  } catch (err) {
    next(err);
  }
});

const PERSONALIZATION_MODES = ['stable', 'balanced', 'trending', 'custom'] as const;
type PersonalizationMode = (typeof PERSONALIZATION_MODES)[number];

/**
 * POST /api/analyze/personalized
 *
 * Contract-only endpoint for the upcoming personalized recommendation flow
 * (Stable / Trending / Personal-Match weighting + focus-skill selection).
 *
 * The time-based / personalized model logic is NOT implemented yet, so a valid
 * request is acknowledged with 501 + PERSONALIZATION_NOT_IMPLEMENTED. The
 * frontend uses this code to offer an explicit fallback to POST /api/analyze.
 * Validation runs first so the request contract is exercised end-to-end today.
 */
router.post('/personalized', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { canonicalTitle, cvText, personalization } = req.body as {
      canonicalTitle?: unknown;
      cvText?: unknown;
      personalization?: {
        mode?: unknown;
        weights?: { stable?: unknown; trending?: unknown; personalMatch?: unknown };
        selectedSkillIds?: unknown;
      };
    };

    if (typeof canonicalTitle !== 'string' || !canonicalTitle.trim()) {
      throw new ValidationError('canonicalTitle is required');
    }
    if (typeof cvText !== 'string' || cvText.trim().length < 10) {
      throw new ValidationError('cvText is required (min 10 chars)');
    }
    if (!personalization || typeof personalization !== 'object') {
      throw new ValidationError('personalization is required');
    }

    const { mode, weights, selectedSkillIds } = personalization;
    if (!PERSONALIZATION_MODES.includes(mode as PersonalizationMode)) {
      throw new ValidationError(
        `personalization.mode must be one of: ${PERSONALIZATION_MODES.join(', ')}`
      );
    }

    const { stable, trending, personalMatch } = weights ?? {};
    if (
      typeof stable !== 'number' ||
      typeof trending !== 'number' ||
      typeof personalMatch !== 'number'
    ) {
      throw new ValidationError('personalization.weights must be numbers (stable, trending, personalMatch)');
    }
    if (Math.abs(stable + trending + personalMatch - 100) > 0.5) {
      throw new ValidationError('personalization.weights must sum to 100');
    }

    if (!Array.isArray(selectedSkillIds)) {
      throw new ValidationError('personalization.selectedSkillIds must be an array');
    }
    if (selectedSkillIds.length > 5) {
      throw new ValidationError('You can select up to 5 skills only');
    }

    // Contract validated — personalized model path is not active yet.
    res.status(501).json({
      code: 'PERSONALIZATION_NOT_IMPLEMENTED',
      error: 'Personalized recommendations are not available yet.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analyze/compare-saved
 *
 * After a primary analysis, score starred saved CVs against the same skills using
 * the same LLM scoring pipeline as POST /analyze (parallel, max 3 favorites).
 */
router.post('/compare-saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, jobTitle, skills, currentMatchScore, excludeCvId, expectedSkillCount, cvOnlyMode } = req.body as {
      jobId?: string;
      jobTitle?: string;
      skills?: unknown;
      currentMatchScore?: number;
      excludeCvId?: string;
      expectedSkillCount?: number;
      cvOnlyMode?: boolean;
    };

    if (!jobId) {
      throw new ValidationError('jobId is required');
    }
    if (!jobTitle?.trim()) {
      throw new ValidationError('jobTitle is required');
    }
    if (!skills) {
      throw new ValidationError('skills must be a non-empty array');
    }
    if (typeof currentMatchScore !== 'number') {
      throw new ValidationError('currentMatchScore is required');
    }

    const result = await compareAgainstFavoriteCvs({
      userId: req.user!.id,
      jobId,
      jobTitle: jobTitle.trim(),
      skills,
      currentMatchScore,
      excludeCvId,
      expectedSkillCount: expectedSkillCount ?? (cvOnlyMode ? 5 : 10),
      cvOnlyMode,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
