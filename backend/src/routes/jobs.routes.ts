import { Router } from 'express';
import { getJobs, getCoreSkills, extractSkillsHandler } from '../controllers/jobs.controller';

const router = Router();

// GET /jobs — List all POC jobs for dropdown
router.get('/', getJobs);

// GET /jobs/:id/core-skills — Fetch 5 core skills from DS model for a job
// TODO (Phase 3): Blocked on DS team — currently uses mock DS model
router.get('/:id/core-skills', getCoreSkills);

// POST /jobs/extract — Extract 5 dynamic skills from job description provided by client
// Note: jobDescription comes from the UI (user-pasted job posting), not from DB.
// TODO: Replace jobTitle validation with vector DB semantic matching in production
router.post('/extract', extractSkillsHandler);

export default router;
