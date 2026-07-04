import { Router } from 'express';
import { scoreCV } from '../controllers/score.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// POST /api/score - Score CV against 10 assembled skills and persist result
router.post('/', scoreCV);

export default router;
