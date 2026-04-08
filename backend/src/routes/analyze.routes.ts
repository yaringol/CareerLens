import { Router, Request, Response, NextFunction } from 'express';
import {
  validateJobTitle,
  validateJobById,
  getCoreSkillsById,
  extractDynamicSkills,
} from '../services/job.service';
import { scoreAndPersist } from '../services/scoring.service';
import { ValidationError } from '../errors';
import type { IJob } from '../models/job.model';
import { logAnalyzeOk } from '../utils/pocLog';

const router = Router();

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

/**
 * POST /api/analyze
 *
 * POC: { jobId, cvText, jobDescription } — user supplies the JD text for dynamic skill extraction;
 *       jobId selects role (core skills + DB record). Stored Job.description is not used for extraction.
 * Legacy: { jobTitle, jobDescription, cvText }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
      const jd =
        typeof jobDescription === 'string' ? jobDescription.trim() : '';
      if (jd.length < MIN_JOB_DESCRIPTION_CHARS) {
        throw new ValidationError(
          `jobDescription is required (at least ${MIN_JOB_DESCRIPTION_CHARS} characters) — paste the job posting for skill extraction`
        );
      }
      descriptionForDynamic = jd;
    } else if (jobTitle && jobDescription && cvText) {
      job = await validateJobTitle(jobTitle);
      descriptionForDynamic = jobDescription;
    } else {
      throw new ValidationError(
        'Provide jobId, cvText, and jobDescription, or jobTitle, jobDescription, and cvText'
      );
    }

    const id = job._id.toString();

    const [{ coreSkills }, { extractedSkills: dynamicSkills }] = await Promise.all([
      getCoreSkillsById(id),
      extractDynamicSkills(job.title, descriptionForDynamic),
    ]);

    const allSkills = mergeTenSkills(job.title, coreSkills, dynamicSkills);

    const analysis = await scoreAndPersist({
      jobId: id,
      jobTitle: job.title,
      cvText: cvText.trim(),
      skills: allSkills,
      cvFileName: id,
    });

    logAnalyzeOk(job.title);

    res.json({
      jobTitle: analysis.jobTitle,
      skills: analysis.scores.map((s) => ({ name: s.skill, score: s.score })),
      matchScore: analysis.matchScore,
      id: analysis._id.toString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
