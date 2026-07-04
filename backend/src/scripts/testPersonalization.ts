/**
 * Standalone unit tests for personalization.service.ts — no Mongo/DS server required,
 * pure-logic checks in the same style as ds/model/test_preferences.py.
 *
 * Run from backend/: npm run test-personalization
 */
import { computeStabilityPreference, selectPersonalizedSkills } from '../services/personalization.service';
import type { TrendingSkill } from '../services/dsModel';

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ── computeStabilityPreference — validated against the 3 named UI presets ─────
// (PersonalizationScreen.tsx PRESETS: stable={60,15,25}, balanced={33,33,34}, trending={15,60,25})

check(
  'stable preset -> 0.20',
  Math.abs(computeStabilityPreference(60, 15) - 0.2) < 1e-9
);
check(
  'balanced preset -> exactly 0.50',
  computeStabilityPreference(33, 33) === 0.5
);
check(
  'trending preset -> 0.80',
  Math.abs(computeStabilityPreference(15, 60) - 0.8) < 1e-9
);
check(
  'degenerate (stable=trending=0) -> neutral 0.5',
  computeStabilityPreference(0, 0) === 0.5
);

// ── selectPersonalizedSkills ───────────────────────────────────────────────────

function makeSkill(skill: string, stabilityScore: number, prevalence = 0.5): TrendingSkill {
  return { skill, trend: 'stable', prevalence, stabilityScore, timeFeaturesReliable: true };
}

const CANDIDATES: TrendingSkill[] = [
  makeSkill('java', 0.05, 0.9),
  makeSkill('sql', 0.1, 0.85),
  makeSkill('docker', 0.45, 0.7),
  makeSkill('kubernetes', 0.55, 0.65),
  makeSkill('react', 0.3, 0.6),
  makeSkill('pandas', 0.6, 0.55),
  makeSkill('pytorch', 0.9, 0.5),
  makeSkill('llm', 0.95, 0.45),
  makeSkill('rag', 0.98, 0.4),
  makeSkill('langchain', 0.97, 0.35),
];

const stableLeaning = selectPersonalizedSkills(CANDIDATES, 0.2, []);
check(
  'stable-leaning preference (0.2) picks the 5 lowest-stability skills',
  stableLeaning.length === 5 &&
    ['java', 'sql', 'docker', 'react'].every((s) => stableLeaning.includes(s)),
  `got ${JSON.stringify(stableLeaning)}`
);

const trendingLeaning = selectPersonalizedSkills(CANDIDATES, 0.8, []);
check(
  'trending-leaning preference (0.8) picks the 5 highest-stability skills',
  trendingLeaning.length === 5 &&
    ['pytorch', 'llm', 'rag', 'langchain'].every((s) => trendingLeaning.includes(s)),
  `got ${JSON.stringify(trendingLeaning)}`
);

const balanced = selectPersonalizedSkills(CANDIDATES, 0.5, []);
check('balanced preference (0.5) still returns exactly 5 skills', balanced.length === 5);

const withOverride = selectPersonalizedSkills(CANDIDATES, 0.2, ['pytorch', 'llm']);
check(
  'explicit selectedSkillIds always win their slots',
  withOverride.includes('pytorch') && withOverride.includes('llm') && withOverride.length === 5,
  `got ${JSON.stringify(withOverride)}`
);

const fullOverride = selectPersonalizedSkills(CANDIDATES, 0.2, [
  'java', 'sql', 'docker', 'kubernetes', 'react',
]);
check(
  '5 explicit selectedSkillIds are returned as-is, ignoring preference',
  fullOverride.length === 5 &&
    ['java', 'sql', 'docker', 'kubernetes', 'react'].every((s) => fullOverride.includes(s))
);

console.log(failures ? `\n${failures} test(s) FAILED.` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);
