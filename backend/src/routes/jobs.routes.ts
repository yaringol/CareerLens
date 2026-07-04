import { Router, Request, Response, NextFunction } from 'express';
import { getAllJobs } from '../dal/job.dal';
import { extractSkills } from '../agents/skillExtraction.agent';
import { authenticate } from '../middleware/auth.middleware';
import { fetchJobPostingFromUrl } from '../services/jobPostingFetcher.service';
import { ValidationError } from '../errors';

const router = Router();
router.use(authenticate);

// GET /jobs — List all supported roles for the dropdown
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await getAllJobs();
    res.json(jobs.map((j) => ({ id: String(j._id), title: j.title })));
  } catch (err) {
    next(err);
  }
});

// POST /jobs/fetch-description — Fetch job description text from a public posting URL
router.post('/fetch-description', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new ValidationError('url is required');
    }
    const result = await fetchJobPostingFromUrl(url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/extract — Extract 5 dynamic skills from job description provided by client
router.post('/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobTitle, jobDescription } = req.body as {
      jobTitle?: string;
      jobDescription?: string;
    };

    if (!jobTitle || !jobDescription) {
      res.status(400).json({ error: 'jobTitle and jobDescription are required' });
      return;
    }

    const extractedSkills = await extractSkills(jobDescription);
    res.json({ jobTitle, extractedSkills });
  } catch (err) {
    next(err);
  }
});

export default router;
