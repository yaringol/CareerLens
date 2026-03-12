import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { getAnalysisById } from '../dal/cvAnalysis.dal';
import { ValidationError, NotFoundError } from '../errors';

export async function getResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new ValidationError('Invalid result ID');
    }

    const analysis = await getAnalysisById(id);
    if (!analysis) throw new NotFoundError('Analysis not found');

    res.json(analysis);
  } catch (err) {
    next(err);
  }
}
