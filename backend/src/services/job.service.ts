import mongoose from 'mongoose';
import { getPocJobsForList, getJobById, getJobByTitle } from '../dal/job.dal';
import { IJob } from '../models/job.model';
import { getCoreSkills } from './dsModel';
import { extractSkills } from '../agents/skillExtraction.agent';
import { ValidationError, NotFoundError, DsModelError } from '../errors';
import {
  logFallbackDynamicSkills,
  logJobDescriptionForExtraction,
  logLlmDynamicSkillsOk,
  logDebugText,
} from '../utils/pocLog';

export async function listJobs(): Promise<IJob[]> {
  const jobs = await getPocJobsForList();
  if (jobs.length !== 5) {
    throw new DsModelError(
      `POC requires exactly 5 jobs with titles: Software Engineer, Data Scientist, Product Manager, DevOps Engineer, Frontend Developer. Found ${jobs.length}. From the backend directory run: npm run seed`,
      503
    );
  }
  return jobs;
}

export async function getCoreSkillsById(jobId: string): Promise<{
  jobId: string;
  jobTitle: string;
  coreSkills: string[];
}> {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new ValidationError('Invalid job ID format');
  }

  const job = await getJobById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  // TODO (Phase 3): Replace mock DS model with real DS model call:
  //   dsModel.getCoreSkills(job.normalizedTitle)
  // Blocked on DS team delivery — see src/interfaces/dsModel.interface.ts
  const coreSkills = getCoreSkills(job.title);
  if (!coreSkills) {
    throw new DsModelError(`No core skills available for job title "${job.title}"`, 503);
  }
  if (coreSkills.length !== 5) {
    throw new DsModelError('DS model returned invalid skill count');
  }

  return { jobId: String(job._id), jobTitle: job.title, coreSkills };
}

/** Per-job static fallback when LLM skill extraction fails — avoids identical dynamics for every role. */
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

export type DynamicSkillsSource = 'llm_job_description' | 'static_fallback_per_job' | 'static_fallback_generic';

export async function extractDynamicSkills(
  jobTitle: string,
  jobDescription: string
): Promise<{
  jobTitle: string;
  extractedSkills: string[];
  dynamicSource: DynamicSkillsSource;
}> {
  try {
    logJobDescriptionForExtraction(jobTitle, jobDescription.length);
    logDebugText('job description (extractSkills input)', jobDescription, 400);
    const extractedSkills = await extractSkills(jobDescription);
    logLlmDynamicSkillsOk(jobTitle, extractedSkills);
    return { jobTitle, extractedSkills, dynamicSource: 'llm_job_description' };
  } catch {
    const perJob = FALLBACK_DYNAMIC_BY_TITLE[jobTitle];
    if (perJob && perJob.length === 5) {
      logFallbackDynamicSkills(jobTitle, 'per_job');
      return { jobTitle, extractedSkills: [...perJob], dynamicSource: 'static_fallback_per_job' };
    }
    logFallbackDynamicSkills(jobTitle, 'generic');
    return {
      jobTitle,
      extractedSkills: [...FALLBACK_DYNAMIC_GENERIC],
      dynamicSource: 'static_fallback_generic',
    };
  }
}

export async function validateJobTitle(jobTitle: string): Promise<IJob> {
  // TODO: Replace with vector DB semantic title matching in production
  const job = await getJobByTitle(jobTitle);
  if (!job) {
    throw new NotFoundError(`Job title "${jobTitle}" not found. Must be one of the 5 POC jobs.`);
  }
  return job;
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
