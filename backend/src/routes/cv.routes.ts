import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { uploadMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth.middleware';
import { processUpload } from '../services/cv.service';
import { detectTitleFromCv, rolesToSuggestions } from '../services/dsModel';
import { CvFile } from '../models/cvFile.model';
import { ValidationError } from '../errors';
import { extractTitleFromCv, matchTitle } from '../services/dsModel';
import {
  enforceSavedCvLimit,
  MAX_SAVED_CVS,
  setCvFavorite,
} from '../services/compareSaved.service';

const router = Router();
router.use(authenticate);

// POST /api/cv/title — Detect the most likely role from raw CV text.
router.post('/cv/title', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { cvText } = req.body as { cvText?: unknown };
    if (typeof cvText !== 'string' || cvText.trim().length < 50) {
      throw new ValidationError('cvText must contain at least 50 characters');
    }

    const roles = await detectTitleFromCv(cvText);
    const suggestions = rolesToSuggestions(roles);
    const top = suggestions[0];
    res.json({
      detectedTitle: top ? top.matchedVariant : null,
      confidence: top ? top.confidence : 0,
      source: top ? 'experience' : 'none',
      suggestions,
    });
  } catch (err) {
    next(err);
  }
});

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

    const userId = new Types.ObjectId(req.user!.id);
    await enforceSavedCvLimit(userId);

    const cvFile = await CvFile.create({
      userId,
      fileName: req.file.originalname,
      cvText,
      fileSizeBytes: req.file.size,
      isFavorite: false,
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

// GET /api/cv — List current user's saved CVs (no cvText — too heavy), max 10
router.get('/cv', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = await CvFile.find({ userId: req.user!.id })
      .select('_id fileName uploadedAt fileSizeBytes isFavorite')
      .sort({ uploadedAt: -1 })
      .limit(MAX_SAVED_CVS)
      .lean();

    res.json(
      files.map((f) => ({
        cvId: f._id.toString(),
        fileName: f.fileName,
        uploadedAt: f.uploadedAt,
        fileSizeBytes: f.fileSizeBytes,
        isFavorite: f.isFavorite ?? false,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cv/:id/favorite — Star or unstar a saved CV (max 3 favorites)
router.patch('/cv/:id/favorite', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { favorite } = req.body as { favorite?: unknown };
    if (typeof favorite !== 'boolean') {
      throw new ValidationError('favorite must be a boolean');
    }
    const result = await setCvFavorite(req.user!.id, req.params.id, favorite);
    res.json(result);
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

// POST /api/cv/extract-title — Detect user's current role from CV text
router.post('/cv/extract-title', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { cvText } = req.body as { cvText?: string };
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length < 10) {
      throw new ValidationError('cvText is required (min 10 chars)');
    }
    const result = await extractTitleFromCv(cvText);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/title/match?title=... — Return top-3 canonical title matches
router.get('/title/match', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const title = req.query.title as string | undefined;
    if (!title || title.trim().length < 2) {
      throw new ValidationError('title query param is required');
    }
    const result = await matchTitle(title.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
