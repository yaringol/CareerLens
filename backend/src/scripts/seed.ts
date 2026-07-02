import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Job } from '../models/job.model';

const DS_MODEL_URL = process.env.DS_MODEL_URL ?? 'http://localhost:8000';

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Roles are the canonical titles the DS model was trained on (single source of truth). */
async function fetchCanonicalTitles(): Promise<string[]> {
  const res = await axios.get<{ titles?: Array<{ title?: unknown }> }>(
    `${DS_MODEL_URL}/titles`,
    { timeout: 5000 }
  );
  const titles = (res.data?.titles ?? [])
    .map((t) => (typeof t.title === 'string' ? t.title.trim() : ''))
    .filter(Boolean);
  if (titles.length === 0) {
    throw new Error('DS model /titles returned no canonical titles');
  }
  return titles;
}

async function seed() {
  await connectDB();

  const titles = await fetchCanonicalTitles();
  await Job.deleteMany({});
  console.log('Cleared existing roles');

  await Job.insertMany(titles.map((title) => ({ title, normalizedTitle: slug(title) })));
  console.log(`Seeded ${titles.length} roles from DS /titles`);

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
