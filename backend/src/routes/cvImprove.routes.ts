import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { extractContext } from '../services/cvImprove.service';
import { rephraseSkill, addSkillSentence, mergeCv, type Proficiency } from '../agents/suggestions.agent';
import { ImprovementSession } from '../models/improvementSession.model';
import { ValidationError } from '../errors';

const router = Router();
router.use(authenticate);

/**
 * POST /api/cv-improve/prepare
 * Extracts relevant CV paragraphs for each weak skill (no LLM).
 */
router.post('/prepare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cvText, weakSkills } = req.body as {
      cvText?: string;
      weakSkills?: Array<{ skill: string; score: number }>;
    };

    if (!cvText || typeof cvText !== 'string' || cvText.trim().length < 50) {
      throw new ValidationError('cvText is required (min 50 chars)');
    }
    if (!Array.isArray(weakSkills) || weakSkills.length === 0) {
      throw new ValidationError('weakSkills array is required');
    }

    const result = extractContext(cvText.trim(), weakSkills);

    res.json({
      skills: result.skills.map((ctx) => ({
        skill: ctx.skill,
        score: ctx.score,
        found: ctx.found,
        occurrences: ctx.occurrences.map((o) => ({ sectionId: o.sectionId, text: o.text })),
        primaryOccurrence: ctx.primaryOccurrence
          ? { sectionId: ctx.primaryOccurrence.sectionId, text: ctx.primaryOccurrence.text }
          : null,
        sharedWith: ctx.sharedWith,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/suggest
 * Generates a rephrase or addition for one skill (LLM call).
 */
router.post('/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skill, proficiency, oldText, jobTitle, found } = req.body as {
      skill?: string;
      proficiency?: Proficiency;
      oldText?: string | null;
      jobTitle?: string;
      found?: boolean;
    };

    if (!skill || !proficiency || !jobTitle) {
      throw new ValidationError('skill, proficiency, and jobTitle are required');
    }

    const validProficiencies: Proficiency[] = ['no_knowledge', 'beginner', 'intermediate', 'proficient', 'expert'];
    if (!validProficiencies.includes(proficiency)) {
      throw new ValidationError(`proficiency must be one of: ${validProficiencies.join(', ')}`);
    }

    let suggestedText: string;

    if (found && oldText && oldText.trim().length > 0) {
      suggestedText = await rephraseSkill(skill, proficiency, oldText.trim(), jobTitle);
    } else {
      // Either not found, or found but primaryOccurrence text is missing — add new sentence
      suggestedText = await addSkillSentence(skill, proficiency, jobTitle);
    }

    res.json({ suggestedText });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/merge
 * Merges all approved improvements into a full CV (LLM call).
 */
router.post('/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { originalCvText, jobTitle, improvements } = req.body as {
      originalCvText?: string;
      jobTitle?: string;
      improvements?: Array<{
        skill: string;
        proficiency: string;
        sectionId: string | null;
        originalText: string | null;
        finalText: string;
        found: boolean;
      }>;
    };

    if (!originalCvText || typeof originalCvText !== 'string') {
      throw new ValidationError('originalCvText is required');
    }
    if (!jobTitle || typeof jobTitle !== 'string') {
      throw new ValidationError('jobTitle is required');
    }
    if (!Array.isArray(improvements) || improvements.length === 0) {
      throw new ValidationError('improvements array is required');
    }

    const mergedCvText = await mergeCv({ originalCvText, jobTitle, improvements });

    res.json({ mergedCvText });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/sessions
 * Saves a completed improvement session to DB.
 */
router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { jobTitle, analysisId, originalCvText, finalCvText, improvements } = req.body as {
      jobTitle?: string;
      analysisId?: string;
      originalCvText?: string;
      finalCvText?: string;
      improvements?: unknown[];
    };

    if (!jobTitle || !analysisId || !originalCvText || !finalCvText) {
      throw new ValidationError('jobTitle, analysisId, originalCvText, finalCvText are required');
    }

    const session = await ImprovementSession.create({
      userId,
      jobTitle,
      analysisId,
      originalCvText,
      finalCvText,
      improvements: improvements ?? [],
    });

    res.status(201).json({ id: session._id.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cv-improve/sessions
 * Returns all improvement sessions for the authenticated user.
 */
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const sessions = await ImprovementSession.find({ userId })
      .sort({ createdAt: -1 })
      .select('jobTitle analysisId createdAt improvements');

    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        jobTitle: s.jobTitle,
        analysisId: s.analysisId,
        createdAt: s.createdAt,
        skillCount: s.improvements.filter((i) => !i.skipped).length,
      }))
    );
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/cv-improve/sessions/:id
 * Deletes an improvement session.
 */
router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const session = await ImprovementSession.findOne({ _id: id, userId });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await session.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
