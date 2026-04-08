import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Job } from '../models/job.model';

const POC_JOBS = [
  { title: 'Software Engineer', normalizedTitle: 'software-engineer' },
  { title: 'Data Scientist', normalizedTitle: 'data-scientist' },
  { title: 'Product Manager', normalizedTitle: 'product-manager' },
  { title: 'DevOps Engineer', normalizedTitle: 'devops-engineer' },
  { title: 'Frontend Developer', normalizedTitle: 'frontend-developer' },
];

async function seed() {
  await connectDB();

  await Job.deleteMany({});
  console.log('Cleared existing jobs');

  await Job.insertMany(POC_JOBS);
  console.log('Seeded 5 jobs');

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
