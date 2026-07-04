import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { CvAnalysis } from '../models/cvAnalysis.model';
import { User } from '../models/user.model';
import { getModelStatus } from '../services/modelStatus.service';
import {
  abortPipeline,
  getPipelineStatus,
  triggerPipeline,
} from '../services/pipelineTrigger.service';

const router = Router();

router.get(
  '/analyses',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobTitle, minScore, startDate, endDate } = req.query as Record<string, string | undefined>;

      const filter: Record<string, unknown> = {};

      if (jobTitle) {
        filter.jobTitle = { $regex: jobTitle, $options: 'i' };
      }
      if (minScore !== undefined) {
        const min = parseFloat(minScore);
        if (!isNaN(min)) filter.matchScore = { $gte: min };
      }
      if (startDate || endDate) {
        const dateFilter: Record<string, Date> = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        filter.createdAt = dateFilter;
      }

      const analyses = await CvAnalysis.find(filter).sort({ createdAt: -1 }).lean();

      const userIds = [
        ...new Set(
          analyses
            .map((a) => a.userId?.toString())
            .filter((id): id is string => Boolean(id))
        ),
      ];
      const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }).select('email').lean()
        : [];
      const emailById = Object.fromEntries(users.map((u) => [u._id.toString(), u.email]));

      const result = analyses.map((a) => ({
        id: a._id.toString(),
        jobTitle: a.jobTitle,
        matchScore: a.matchScore,
        createdAt: a.createdAt,
        userEmail: a.userId ? emailById[a.userId.toString()] ?? null : null,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/model-status',
  authenticate,
  requireRole('admin'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await getModelStatus());
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/pipeline/status',
  authenticate,
  requireRole('admin'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await getPipelineStatus());
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/pipeline/trigger',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const triggeredBy = req.user?.email ?? req.user?.id ?? 'admin';
      res.status(202).json(await triggerPipeline(triggeredBy));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/pipeline/abort',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const abortedBy = req.user?.email ?? req.user?.id ?? 'admin';
      res.status(200).json(await abortPipeline(abortedBy));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
