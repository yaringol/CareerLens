import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { getTitleMatches } from '../services/dsModel';

const router = Router();
router.use(authenticate);

// POST /api/title/match - Map a free-text role to model-supported canonical titles.
router.post('/match', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title } = req.body as { title?: unknown };
    if (typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('title is required');
    }

    res.json(await getTitleMatches(title));
  } catch (err) {
    next(err);
  }
});

export default router;
