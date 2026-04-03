import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Job } from '../models/job.model';

const POC_JOBS = [
  {
    title: 'Software Engineer',
    normalizedTitle: 'software-engineer',
    description:
      'Design and build scalable backend services. Strong experience with REST APIs, automated testing, code review, and CI/CD. Collaborate on architecture decisions and performance tuning.',
  },
  {
    title: 'Data Scientist',
    normalizedTitle: 'data-scientist',
    description:
      'Build and evaluate ML models, run experiments, and communicate insights. Proficiency in Python, SQL, statistics, and visualization tools. Work with stakeholders to define metrics and hypotheses.',
  },
  {
    title: 'Product Manager',
    normalizedTitle: 'product-manager',
    description:
      'Own roadmap and prioritization. Run discovery with users, align engineering and design, and use data to validate decisions. Experience with agile delivery and stakeholder management.',
  },
  {
    title: 'DevOps Engineer',
    normalizedTitle: 'devops-engineer',
    description:
      'Automate deployments and manage cloud infrastructure. Hands-on with Docker, Kubernetes, Terraform, and CI/CD pipelines. Ensure reliability, monitoring, and security best practices.',
  },
  {
    title: 'Frontend Developer',
    normalizedTitle: 'frontend-developer',
    description:
      'Implement responsive UIs with React and TypeScript. Focus on accessibility, performance, and collaboration with UX. Experience with modern build tooling and cross-browser testing.',
  },
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
