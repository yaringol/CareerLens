import { Request, Response, NextFunction } from 'express';
import { listJobs, getCoreSkillsById, extractDynamicSkills } from '../services/job.service';
import { ValidationError } from '../errors';

export async function getJobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobs = await listJobs();
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

export async function getCoreSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getCoreSkillsById(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function extractSkillsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobTitle, jobDescription } = req.body as { jobTitle?: string; jobDescription?: string };

    if (!jobTitle || !jobDescription) {
      throw new ValidationError('jobTitle and jobDescription are required');
    }

    const result = await extractDynamicSkills(jobTitle, jobDescription);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
