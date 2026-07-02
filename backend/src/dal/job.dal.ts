import { Job, IJob } from '../models/job.model';

/** All supported roles, alphabetical by title. */
export async function getAllJobs(): Promise<IJob[]> {
  return Job.find({}, { title: 1, normalizedTitle: 1 }).sort({ title: 1 });
}

export async function getJobByTitle(title: string): Promise<IJob | null> {
  return Job.findOne({ title }, { title: 1, normalizedTitle: 1, description: 1 });
}

export async function getJobById(id: string): Promise<IJob | null> {
  return Job.findById(id, { title: 1, normalizedTitle: 1, description: 1 });
}
