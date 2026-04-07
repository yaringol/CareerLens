import { Router } from 'express';
import { uploadMiddleware } from '../middleware/upload';
import { uploadCv } from '../controllers/cv.controller';

const router = Router();

// POST /api/upload — Upload PDF and extract text
router.post('/upload', uploadMiddleware.single('file'), uploadCv);

export default router;
