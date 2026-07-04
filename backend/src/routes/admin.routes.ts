import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { CvAnalysis } from '../models/cvAnalysis.model';
import { User } from '../models/user.model';
import {
  getModelStatusCollectionStats,
  getModelStatusSummary,
  getModelStatusTitles,
  MODEL_STATUS_TITLES_PAGE_SIZE,
} from '../services/modelStatus.service';
import {
  abortPipeline,
  getPipelineStatus,
  triggerPipeline,
} from '../services/pipelineTrigger.service';

const router = Router();

const ANALYSES_DEFAULT_LIMIT = 50;
const ANALYSES_MAX_LIMIT = 200;

router.get(
  '/analyses',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobTitle, minScore, startDate, endDate, limit: limitParam, offset: offsetParam } =
        req.query as Record<string, string | undefined>;

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

      const limitRaw = parseInt(String(limitParam ?? ANALYSES_DEFAULT_LIMIT), 10);
      const limit = Math.min(
        Math.max(1, Number.isFinite(limitRaw) ? limitRaw : ANALYSES_DEFAULT_LIMIT),
        ANALYSES_MAX_LIMIT
      );
      const offsetRaw = parseInt(String(offsetParam ?? '0'), 10);
      const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

      const [analyses, total] = await Promise.all([
        CvAnalysis.find(filter)
          .select('jobTitle matchScore createdAt userId')
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        CvAnalysis.countDocuments(filter),
      ]);

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

      const items = analyses.map((a) => ({
        id: a._id.toString(),
        jobTitle: a.jobTitle,
        matchScore: a.matchScore,
        createdAt: a.createdAt,
        userEmail: a.userId ? emailById[a.userId.toString()] ?? null : null,
      }));

      res.json({
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      });
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
      res.json(await getModelStatusSummary());
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/model-status/collection-stats',
  authenticate,
  requireRole('admin'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await getModelStatusCollectionStats());
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/model-status/titles',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = typeof req.query.runId === 'string' ? req.query.runId.trim() : '';
      if (!runId) {
        res.status(400).json({ error: 'runId is required' });
        return;
      }

      const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
      const limitRaw = parseInt(String(req.query.limit ?? MODEL_STATUS_TITLES_PAGE_SIZE), 10);
      const limit = Number.isFinite(limitRaw) ? limitRaw : MODEL_STATUS_TITLES_PAGE_SIZE;

      res.json(await getModelStatusTitles(runId, offset, limit));
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
