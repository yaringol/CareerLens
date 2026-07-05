/**
 * Batch-check: for each PDF in repo ../CVs, print matchScore for every supported role.
 * Uses the same pipeline as POST /api/analyze (skills merge + scoreAndPersist).
 *
 * Run from backend/: npm run check-cvs
 * Requires: MongoDB seeded (npm run seed), optional OPENAI_API_KEY in .env
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { getAllJobs, getJobById } from '../dal/job.dal';
import { getCoreSkillsById, extractDynamicSkills } from '../services/job.service';
import { processUpload } from '../services/cv.service';
import { scoreAndPersist } from '../services/scoring.service';
import { mergeTenSkills } from '../routes/analyze.routes';

const CV_DIR = path.resolve(process.cwd(), '..', 'CVs');

async function main() {
  if (!fs.existsSync(CV_DIR)) {
    console.error(`CV folder not found: ${CV_DIR}`);
    process.exit(1);
  }

  await connectDB();

  const jobs = await getAllJobs();
  if (jobs.length === 0) {
    console.error('No roles in DB. Run: npm run seed');
    process.exit(1);
  }

  const pdfs = fs.readdirSync(CV_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) {
    console.error(`No PDFs in ${CV_DIR}`);
    process.exit(1);
  }

  console.log('file\tjobTitle\tmatchScore\tchars');
  console.log('-'.repeat(72));

  for (const file of pdfs) {
    const buffer = fs.readFileSync(path.join(CV_DIR, file));
    let cvText: string;
    try {
      const { cvText: t } = await processUpload(buffer, file);
      cvText = t;
    } catch (e) {
      console.log(`${file}\t-\tPARSE_FAIL\t${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const j of jobs) {
      const id = j._id.toString();
      const full = await getJobById(id);
      const title = full?.title ?? j.title;
      const descriptionForDynamic =
        full?.description?.trim() ||
        `${title}: professional role requiring strong execution, collaboration, and domain-relevant technical skills.`;

      try {
        const [{ coreSkills }, { topFive: dynamicSkills }] = await Promise.all([
          getCoreSkillsById(id),
          extractDynamicSkills(title, descriptionForDynamic),
        ]);
        const allSkills = mergeTenSkills(title, coreSkills, dynamicSkills);
        const analysis = await scoreAndPersist({
          jobId: id,
          jobTitle: title,
          cvText,
          skills: allSkills,
          cvFileName: file,
        });
        console.log(`${file}\t${title}\t${analysis.matchScore}\t${cvText.length}`);
      } catch (e) {
        console.log(
          `${file}\t${title}\tERROR\t${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
