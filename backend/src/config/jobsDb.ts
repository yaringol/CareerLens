import mongoose from 'mongoose';
import { requireMongoUri } from './mongoUri';

let jobsConnection: mongoose.Connection | null = null;

export function getJobsMongoUri(): string {
  return requireMongoUri('JOBS_MONGO_URI');
}

export async function getJobsConnection(): Promise<mongoose.Connection> {
  if (jobsConnection?.readyState === 1) {
    return jobsConnection;
  }
  jobsConnection = mongoose.createConnection(getJobsMongoUri());
  await jobsConnection.asPromise();
  return jobsConnection;
}

export async function closeJobsConnection(): Promise<void> {
  if (jobsConnection) {
    await jobsConnection.close();
    jobsConnection = null;
  }
}
