import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { composeCvFromSections, extractContext, type CvSection } from '../services/cvImprove.service';
import {
  addSkillSentence,
  appendSkillSentenceToSection,
  rephraseSkill,
  type Proficiency,
} from '../agents/suggestions.agent';
import { structureCv } from '../agents/cvStructure.agent';
import { ImprovementSession } from '../models/improvementSession.model';
import { NotFoundError, ValidationError } from '../errors';

const router = Router();
router.use(authenticate);

function isCvSection(value: unknown): value is CvSection {
  if (!value || typeof value !== 'object') return false;
  const section = value as Partial<CvSection>;
  return (
    typeof section.sectionId === 'string' &&
    typeof section.label === 'string' &&
    typeof section.originalText === 'string' &&
    typeof section.currentText === 'string' &&
    typeof section.order === 'number' &&
    typeof section.version === 'number'
  );
}

function buildDisplayName(
  jobTitle: string,
  improvements: unknown[] | undefined,
  createdAt = new Date()
): string {
  const skills = (improvements ?? [])
    .filter((item): item is { skill: string; skipped?: boolean } => (
      !!item &&
      typeof item === 'object' &&
      typeof (item as { skill?: unknown }).skill === 'string' &&
      !(item as { skipped?: boolean }).skipped
    ))
    .map((item) => item.skill.trim())
    .filter(Boolean);

  const date = createdAt.toLocaleDateString('en-GB');
  const unique = [...new Set(skills)];
  if (unique.length > 0 && unique.length <= 2) {
    return `${jobTitle} CV Improvement - ${unique.join(' & ')} - ${date}`;
  }
  const count = unique.length;
  return `${jobTitle} CV Improvement - ${count} Weak Skill${count === 1 ? '' : 's'}`;
}

/**
 * POST /api/cv-improve/prepare
 * Splits the CV into stable sections and maps weak skills to target sections.
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
      sections: result.sections,
      skills: result.skills.map((ctx) => ({
        skill: ctx.skill,
        score: ctx.score,
        found: ctx.found,
        occurrences: ctx.occurrences.map((o) => ({ sectionId: o.sectionId, text: o.text })),
        primaryOccurrence: ctx.primaryOccurrence
          ? { sectionId: ctx.primaryOccurrence.sectionId, text: ctx.primaryOccurrence.text }
          : null,
        sharedWith: ctx.sharedWith,
        targetSectionId: ctx.targetSectionId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/suggest
 * Generates a candidate section text from the latest section state.
 */
router.post('/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      skill,
      proficiency,
      sectionId,
      originalSectionText,
      currentSectionText,
      oldText,
      jobTitle,
      found,
    } = req.body as {
      skill?: string;
      proficiency?: Proficiency;
      sectionId?: string;
      originalSectionText?: string;
      currentSectionText?: string;
      oldText?: string | null;
      jobTitle?: string;
      found?: boolean;
    };

    if (!skill || !proficiency || !sectionId || !jobTitle) {
      throw new ValidationError('skill, proficiency, sectionId, and jobTitle are required');
    }

    const validProficiencies: Proficiency[] = ['no_knowledge', 'beginner', 'intermediate', 'proficient', 'expert'];
    if (!validProficiencies.includes(proficiency)) {
      throw new ValidationError(`proficiency must be one of: ${validProficiencies.join(', ')}`);
    }

    const sectionText = typeof currentSectionText === 'string'
      ? currentSectionText.trim()
      : oldText?.trim() ?? '';
    const originalText = typeof originalSectionText === 'string'
      ? originalSectionText.trim()
      : sectionText;

    if (!sectionText) {
      throw new ValidationError('currentSectionText is required');
    }

    let suggestedText: string;
    if (found) {
      suggestedText = await rephraseSkill(skill, proficiency, sectionText, jobTitle, originalText);
    } else {
      const sentence = await addSkillSentence(skill, proficiency, jobTitle);
      suggestedText = appendSkillSentenceToSection(sectionText, sentence);
    }

    res.json({ suggestedText });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/merge
 * Composes the final CV from updated sections by order. No full-CV LLM rewrite.
 */
router.post('/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sections } = req.body as { sections?: unknown[] };

    if (!Array.isArray(sections) || sections.length === 0) {
      throw new ValidationError('sections array is required');
    }
    if (!sections.every(isCvSection)) {
      throw new ValidationError('sections must contain valid CV section objects');
    }

    const mergedCvText = composeCvFromSections({ sections });
    res.json({ mergedCvText });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cv-improve/structure
 * Converts the final CV text into the typed layout used by the designed PDF export.
 */
router.post('/structure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cvText, jobTitle } = req.body as { cvText?: string; jobTitle?: string };

    if (!cvText || typeof cvText !== 'string' || cvText.trim().length < 50) {
      throw new ValidationError('cvText is required (min 50 chars)');
    }

    const structured = await structureCv(
      cvText.trim(),
      typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim() : undefined
    );

    res.json({ structured });
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
    const {
      displayName,
      jobTitle,
      analysisId,
      originalCvText,
      finalCvText,
      improvements,
      sectionUpdates,
    } = req.body as {
      displayName?: string;
      jobTitle?: string;
      analysisId?: string;
      originalCvText?: string;
      finalCvText?: string;
      improvements?: unknown[];
      sectionUpdates?: unknown[];
    };

    if (!jobTitle || !analysisId || !originalCvText || !finalCvText) {
      throw new ValidationError('jobTitle, analysisId, originalCvText, finalCvText are required');
    }

    const now = new Date();
    const session = await ImprovementSession.create({
      userId,
      displayName: displayName?.trim() || buildDisplayName(jobTitle, improvements, now),
      status: 'completed',
      jobTitle,
      analysisId,
      originalCvText,
      finalCvText,
      improvements: improvements ?? [],
      sectionUpdates: Array.isArray(sectionUpdates) ? sectionUpdates : [],
      createdAt: now,
    });

    res.status(201).json({ id: session._id.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cv-improve/sessions
 * Returns completed improvement sessions for the authenticated user.
 */
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const sessions = await ImprovementSession.find({
      userId,
      finalCvText: { $exists: true, $ne: '' },
    })
      .sort({ createdAt: -1 })
      .select('displayName status jobTitle analysisId createdAt improvements finalCvText');

    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        displayName: s.displayName || buildDisplayName(s.jobTitle, s.improvements, s.createdAt),
        status: s.status ?? 'completed',
        jobTitle: s.jobTitle,
        analysisId: s.analysisId,
        createdAt: s.createdAt,
        skillCount: s.improvements.filter((i) => !i.skipped).length,
        hasFinalCvText: Boolean(s.finalCvText),
      }))
    );
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cv-improve/sessions/:id
 * Returns the completed final CV for download/review.
 */
router.get('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await ImprovementSession.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      finalCvText: { $exists: true, $ne: '' },
    });

    if (!session) throw new NotFoundError('Session not found');

    res.json({
      id: session._id.toString(),
      displayName: session.displayName || buildDisplayName(session.jobTitle, session.improvements, session.createdAt),
      status: session.status ?? 'completed',
      jobTitle: session.jobTitle,
      analysisId: session.analysisId,
      originalCvText: session.originalCvText,
      finalCvText: session.finalCvText,
      improvements: session.improvements,
      sectionUpdates: session.sectionUpdates,
      createdAt: session.createdAt,
    });
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
