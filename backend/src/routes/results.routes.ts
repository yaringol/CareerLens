import { Router } from 'express';
import { getResult } from '../controllers/results.controller';

const router = Router();

// GET /results/:id — Fetch stored analysis by ID
router.get('/:id', getResult);

export default router;
