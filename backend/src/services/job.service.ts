import mongoose from 'mongoose';
import { getAllJobs, getJobById, getJobByTitle } from '../dal/job.dal';
import { IJob } from '../models/job.model';
import { getCoreSkills } from './dsModel';
import { extractSkills } from '../agents/skillExtraction.agent';
import { ValidationError, NotFoundError, DsModelError } from '../errors';

export async function listJobs(): Promise<IJob[]> {
  return getAllJobs();
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

export async function extractDynamicSkills(
  jobTitle: string,
  jobDescription: string
): Promise<{ jobTitle: string; extractedSkills: string[] }> {
  // TODO (Phase 3): If jobTitle is a jobId, look up the job description from DB.
  // Currently: jobDescription comes directly from the UI (user-pasted job posting).
  // In production: replace with vector DB title inference to resolve canonical job profile.
  const extractedSkills = await extractSkills(jobDescription);
  return { jobTitle, extractedSkills };
}

export async function validateJobTitle(jobTitle: string): Promise<IJob> {
  // TODO: Replace with vector DB semantic title matching in production
  const job = await getJobByTitle(jobTitle);
  if (!job) {
    throw new NotFoundError(`Job title "${jobTitle}" not found. Must be one of the 5 POC jobs.`);
  }
  return job;
}
