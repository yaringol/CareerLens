import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { uploadMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth.middleware';
import { processUpload } from '../services/cv.service';
import { CvFile } from '../models/cvFile.model';
import { ValidationError } from '../errors';

const router = Router();
router.use(authenticate);

// POST /api/upload — Upload PDF, extract text, optionally save to CVFile library
// Query param: ?save=false to skip saving (just extract text)
router.post('/upload', uploadMiddleware.single('file'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }
    const { cvText } = await processUpload(req.file.buffer, req.file.originalname);
    const save = req.query.save !== 'false';

    if (!save) {
      res.json({ cvId: null, cvText, fileName: req.file.originalname });
      return;
    }

    const cvFile = await CvFile.create({
      userId: new Types.ObjectId(req.user!.id),
      fileName: req.file.originalname,
      cvText,
      fileSizeBytes: req.file.size,
    });

    res.json({
      cvId: cvFile._id.toString(),
      cvText,
      fileName: cvFile.fileName,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cv — List current user's saved CVs (no cvText — too heavy)
router.get('/cv', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = await CvFile.find({ userId: req.user!.id })
      .select('_id fileName uploadedAt fileSizeBytes')
      .sort({ uploadedAt: -1 })
      .lean();

    res.json(
      files.map((f) => ({
        cvId: f._id.toString(),
        fileName: f.fileName,
        uploadedAt: f.uploadedAt,
        fileSizeBytes: f.fileSizeBytes,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/cv/:id — Get single saved CV text by ID
router.get('/cv/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = await CvFile.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
    if (!file) {
      res.status(404).json({ error: 'CV not found' });
      return;
    }
    res.json({ cvId: file._id.toString(), cvText: file.cvText, fileName: file.fileName });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cv/:id — Delete a saved CV
router.delete('/cv/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await CvFile.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'CV not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
