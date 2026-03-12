import { Router } from 'express';
import { scoreCV } from '../controllers/score.controller';

const router = Router();

// POST /score — Score CV against 10 assembled skills and persist result
router.post('/', scoreCV);

export default router;
