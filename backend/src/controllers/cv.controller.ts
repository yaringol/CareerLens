import { Request, Response, NextFunction } from 'express';
import { processUpload } from '../services/cv.service';
import { ValidationError } from '../errors';

export async function uploadCv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }
    const result = await processUpload(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
