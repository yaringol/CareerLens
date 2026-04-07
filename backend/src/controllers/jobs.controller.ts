import { Request, Response, NextFunction } from 'express';
import { listJobs, getCoreSkillsById, extractDynamicSkills } from '../services/job.service';
import { getCoreSkills as lookupCoreSkills } from '../services/dsModel';
import { ValidationError } from '../errors';

export async function getJobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobs = await listJobs();
    const payload = jobs.map((j) => ({
      id: j._id.toString(),
      title: j.title,
      skills: lookupCoreSkills(j.title) ?? [],
    }));
    res.json(payload);
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
