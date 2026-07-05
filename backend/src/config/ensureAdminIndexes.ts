import { getJobsConnection } from './jobsDb';

/** Best-effort indexes for admin dashboard queries (jobs DB collections). */
export async function ensureJobsAdminIndexes(): Promise<void> {
  const conn = await getJobsConnection();
  await Promise.all([
    conn.collection('role_skill_observations').createIndex({ source: 1 }, { background: true }),
    conn.collection('raw_postings').createIndex({ extracted: 1 }, { background: true }),
    conn.collection('lang-uk-job').createIndex({ extracted: 1 }, { background: true }),
    conn.collection('role_skill_features').createIndex({ run_id: 1, title: 1 }, { background: true }),
  ]);
}
