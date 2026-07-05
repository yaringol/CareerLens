import { Router } from 'express';
import { getResult } from '../controllers/results.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// GET /api/results/:id - Fetch stored analysis by ID
router.get('/:id', getResult);

export default router;
