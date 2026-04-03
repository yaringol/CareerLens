import { Job, IJob } from '../models/job.model';

/**
 * Canonical POC job titles — order is the API list order.
 * Must match `POC_JOBS[].title` in `src/scripts/seed.ts`.
 */
export const POC_JOB_TITLES = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'DevOps Engineer',
  'Frontend Developer',
] as const;

/**
 * Returns at most one job per POC title, in `POC_JOB_TITLES` order.
 * Extra non-POC rows in the DB are ignored so GET /api/jobs stays a 5-job POC surface.
 */
export async function getPocJobsForList(): Promise<IJob[]> {
  const docs = await Job.find(
    { title: { $in: [...POC_JOB_TITLES] } },
    { title: 1, normalizedTitle: 1 }
  );
  const byTitle = new Map<string, IJob>();
  for (const d of docs) {
    const t = d.title;
    if (!byTitle.has(t)) byTitle.set(t, d);
  }
  return POC_JOB_TITLES.map((t) => byTitle.get(t)).filter((j): j is IJob => j != null);
}

export async function getAllJobs(): Promise<IJob[]> {
  return Job.find({}, { title: 1, normalizedTitle: 1 });
}

export async function getJobByTitle(title: string): Promise<IJob | null> {
  return Job.findOne({ title }, { title: 1, normalizedTitle: 1, description: 1 });
}

export async function getJobById(id: string): Promise<IJob | null> {
  return Job.findById(id, { title: 1, normalizedTitle: 1, description: 1 });
}
