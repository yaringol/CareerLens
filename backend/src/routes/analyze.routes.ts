import { Router, Request, Response, NextFunction } from 'express';
import { validateJobTitle, getCoreSkillsById, extractDynamicSkills } from '../services/job.service';
import { scoreAndPersist } from '../services/scoring.service';
import { ValidationError } from '../errors';

const router = Router();

/**
 * POST /analyze
 *
 * Single-call orchestration endpoint: job title + job description + CV text → analysis ID.
 * Convenience alternative to the client-side multi-step flow.
 *
 * Flow:
 *  1. Validate jobTitle exists in DB (POC: 5 hardcoded jobs)
 *     TODO: Replace with vector DB semantic title matching in production
 *  2. Fetch 5 core skills from mock DS model
 *     TODO: Replace with real DS model in production (see dsModel.interface.ts)
 *  3. Extract 5 dynamic skills from jobDescription via LLM agent
 *  4. Merge into 10-skill array (5 core + 5 dynamic)
 *  5. Score CV text against all 10 skills
 *  6. Persist analysis to MongoDB
 *  7. Return { id } of the saved analysis
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobTitle, jobDescription, cvText } = req.body as {
      jobTitle?: string;
      jobDescription?: string;
      cvText?: string;
    };

    if (!jobTitle || !jobDescription || !cvText) {
      throw new ValidationError('jobTitle, jobDescription, and cvText are required');
    }

    const job = await validateJobTitle(jobTitle);
    const jobId = String(job._id);

    const [{ coreSkills }, { extractedSkills: dynamicSkills }] = await Promise.all([
      getCoreSkillsById(jobId),
      extractDynamicSkills(jobTitle, jobDescription),
    ]);

    const allSkills = [...coreSkills, ...dynamicSkills];

    const analysis = await scoreAndPersist({
      jobId,
      jobTitle: job.title,
      cvText,
      skills: allSkills,
      cvFileName: jobId,
    });

    res.json({ id: analysis._id });
  } catch (err) {
    next(err);
  }
});

export default router;
