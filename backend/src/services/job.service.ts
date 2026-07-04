import mongoose from 'mongoose';
import { getAllJobs, getJobById, getJobByTitle } from '../dal/job.dal';
import { Job, IJob } from '../models/job.model';
import { getCoreSkills } from './dsModel';
import { extractSkillPool, SKILL_POOL_SIZE, TOP_SKILL_COUNT } from '../agents/skillExtraction.agent';
import { ValidationError, NotFoundError, DsModelError } from '../errors';
import { dedupeSkills } from '../utils/skillDedup';
import {
  logFallbackDynamicSkills,
  logJobDescriptionForExtraction,
  logLlmDynamicSkillsOk,
  logDebugText,
} from '../utils/logger';

export async function listJobs(): Promise<IJob[]> {
  const jobs = await getAllJobs();
  if (jobs.length === 0) {
    throw new DsModelError(
      'No roles found in the database. From the backend directory run: npm run seed',
      503
    );
  }
  return jobs;
}

export async function getCoreSkillsById(jobId: string, titleMatch = 0.0): Promise<{
  jobId: string;
  jobTitle: string;
  coreSkills: string[];
}> {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new ValidationError('Invalid job ID format');
  }

  const job = await getJobById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  const coreSkills = await getCoreSkills(job.title, titleMatch);
  if (!coreSkills) {
    throw new DsModelError(`No core skills available for job title "${job.title}"`, 503);
  }
  if (coreSkills.length !== 5) {
    throw new DsModelError('DS model returned invalid skill count');
  }

  return { jobId: String(job._id), jobTitle: job.title, coreSkills };
}

/** Per-job static fallback when LLM skill extraction fails - avoids identical dynamics for every role. */
const FALLBACK_DYNAMIC_BY_TITLE: Record<string, string[]> = {
  'Software Engineer': [
    'REST and API design',
    'relational database modeling',
    'unit and integration testing discipline',
    'observability and logging practices',
    'secure coding awareness',
  ],
  'Data Scientist': [
    'feature engineering pipelines',
    'A/B testing and causal thinking',
    'model monitoring in production',
    'NLP or computer vision exposure',
    'experiment tracking and reproducibility',
  ],
  'Product Manager': [
    'prioritization frameworks RICE or similar',
    'writing clear PRDs',
    'working with design systems',
    'instrumentation and funnel metrics',
    'release coordination with engineering',
  ],
  'DevOps Engineer': [
    'secrets and config management',
    'networking and load balancing basics',
    'cost optimization in the cloud',
    'on-call and incident workflows',
    'scripting with Bash or Python',
  ],
  'Frontend Developer': [
    'state management patterns',
    'CSS layout systems and design tokens',
    'bundlers and frontend performance budgets',
    'end-to-end testing for UI',
    'working with REST or GraphQL APIs',
  ],
};

const FALLBACK_DYNAMIC_GENERIC = [
  'written communication with stakeholders',
  'breaking down ambiguous problems',
  'mentoring junior teammates',
  'documenting technical decisions',
  'balancing speed with quality',
];

/** Re-export agent constants so callers import from one place if they prefer. */
export { SKILL_POOL_SIZE, TOP_SKILL_COUNT } from '../agents/skillExtraction.agent';

function padFallbackPool(primary: string[], secondary: string[]): string[] {
  return dedupeSkills([...primary, ...secondary], SKILL_POOL_SIZE);
}

export type DynamicSkillsSource = 'llm_job_description' | 'static_fallback_per_job' | 'static_fallback_generic';

export interface DynamicSkillsResult {
  jobTitle: string;
  /** Full 10-skill pool (personalize picker, debugging). */
  pool: string[];
  /** Primary 5 for standard analyze dynamic slots. */
  topFive: string[];
  dynamicSource: DynamicSkillsSource;
}

export async function extractDynamicSkills(
  jobTitle: string,
  jobDescription: string
): Promise<DynamicSkillsResult> {
  try {
    logJobDescriptionForExtraction(jobTitle, jobDescription.length);
    logDebugText('job description (extractSkillPool input)', jobDescription, 400);
    const { pool, topFive } = await extractSkillPool(jobDescription);
    logLlmDynamicSkillsOk(jobTitle, pool);
    return { jobTitle, pool, topFive, dynamicSource: 'llm_job_description' };
  } catch (err) {
    const perJob = FALLBACK_DYNAMIC_BY_TITLE[jobTitle];
    const pool = padFallbackPool(
      perJob ? [...perJob] : [],
      [...FALLBACK_DYNAMIC_GENERIC]
    );
    if (pool.length < SKILL_POOL_SIZE) {
      throw err;
    }
    const trimmed = pool.slice(0, SKILL_POOL_SIZE);
    const source: DynamicSkillsSource = perJob ? 'static_fallback_per_job' : 'static_fallback_generic';
    logFallbackDynamicSkills(jobTitle, perJob ? 'per_job' : 'generic');
    return {
      jobTitle,
      pool: trimmed,
      topFive: trimmed.slice(0, TOP_SKILL_COUNT),
      dynamicSource: source,
    };
  }
}

function toNormalizedTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a canonical title to a Job document. Uses MongoDB when already seeded;
 * otherwise verifies the title with the DS skills model and upserts a Job row.
 */
export async function findOrCreateJobByTitle(jobTitle: string): Promise<IJob> {
  const title = jobTitle.trim();
  if (!title) {
    throw new ValidationError('Job title is required');
  }

  const exact = await getJobByTitle(title);
  if (exact) return exact;

  const byCase = await Job.findOne(
    { title: { $regex: new RegExp(`^${escapeRegExp(title)}$`, 'i') } },
    { title: 1, normalizedTitle: 1, description: 1 }
  );
  if (byCase) return byCase;

  const coreSkills = await getCoreSkills(title);
  if (!coreSkills?.length) {
    throw new NotFoundError(`Job title "${title}" is not supported by the skills model`);
  }

  const normalizedTitle = toNormalizedTitle(title);
  const created = await Job.findOneAndUpdate(
    { normalizedTitle },
    { $setOnInsert: { title, normalizedTitle, description: '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!created) {
    throw new DsModelError(`Failed to register job title "${title}"`, 503);
  }
  return created;
}

export async function validateJobTitle(jobTitle: string): Promise<IJob> {
  return findOrCreateJobByTitle(jobTitle);
}

export async function validateJobById(jobId: string): Promise<IJob> {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new ValidationError('Invalid job ID format');
  }
  const job = await getJobById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }
  return job;
}
