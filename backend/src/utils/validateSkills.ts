import { ValidationError } from '../errors';

const MAX_SKILL_LENGTH = 100;

export function validateSkillArray(skills: unknown, expectedCount: number): string[] {
  if (!Array.isArray(skills)) {
    throw new ValidationError('skills must be an array');
  }
  if (skills.length !== expectedCount) {
    throw new ValidationError(`Exactly ${expectedCount} skills required, got ${skills.length}`);
  }
  for (const skill of skills) {
    if (typeof skill !== 'string' || skill.trim() === '') {
      throw new ValidationError('Skills must be non-empty strings');
    }
    if (skill.length > MAX_SKILL_LENGTH) {
      throw new ValidationError(`Each skill must be at most ${MAX_SKILL_LENGTH} characters`);
    }
  }
  const lower = skills.map((s: string) => s.trim().toLowerCase());
  if (new Set(lower).size !== lower.length) {
    throw new ValidationError('Skills array contains duplicates');
  }
  return skills.map((s: string) => s.trim());
}
