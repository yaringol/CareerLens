import { Request, Response, NextFunction } from 'express';
import { scoreAndPersist } from '../services/scoring.service';
import { ValidationError } from '../errors';

export async function scoreCV(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId, jobTitle, cvText, skills, cvFileName } = req.body as {
      jobId?: string;
      jobTitle?: string;
      cvText?: string;
      skills?: unknown;
      cvFileName?: string;
    };

    if (!jobId) throw new ValidationError('jobId is required');
    if (!jobTitle) throw new ValidationError('jobTitle is required');
    if (!cvText) throw new ValidationError('cvText is required');
    if (!skills) throw new ValidationError('skills must be a non-empty array');

    const analysis = await scoreAndPersist({
      userId: req.user?.id,
      jobId,
      jobTitle,
      cvText,
      skills,
      cvFileName,
    });
    res.json(analysis);
  } catch (err) {
    next(err);
  }
}
