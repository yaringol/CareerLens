import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { CvAnalysis } from '../models/cvAnalysis.model';
import { User } from '../models/user.model';

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

      // Attach user email if userId present
      const userIds = [...new Set(analyses.map((a) => (a as Record<string, unknown>).userId).filter(Boolean))];
      const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }).select('email').lean()
        : [];
      const emailById = Object.fromEntries(users.map((u) => [u._id.toString(), u.email]));

      const result = analyses.map((a) => {
        const rec = a as Record<string, unknown>;
        return {
          id: (rec._id as { toString(): string }).toString(),
          jobTitle: rec.jobTitle,
          matchScore: rec.matchScore,
          createdAt: rec.createdAt,
          userEmail: rec.userId ? emailById[(rec.userId as { toString(): string }).toString()] ?? null : null,
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
