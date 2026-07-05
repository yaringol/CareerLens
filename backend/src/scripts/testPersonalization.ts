/**
 * Standalone unit tests for personalization.service.ts - no Mongo/DS server required,
 * pure-logic checks in the same style as ds/model/test_preferences.py.
 *
 * Run from backend/: npm run test-personalization
 */
import { computeStabilityPreference, selectPersonalizedSkills, selectDynamicSkills } from '../services/personalization.service';
import type { TrendingSkill } from '../services/dsModel';

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    console.log(`FAIL ${label}${detail ? ` - ${detail}` : ''}`);
    failures++;
  }
}

// ── computeStabilityPreference - validated against the 3 named UI presets ─────
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

const stableLeaning = selectPersonalizedSkills(CANDIDATES, 0.2);
check(
  'stable-leaning preference (0.2) picks the 5 lowest-stability skills',
  stableLeaning.length === 5 &&
    ['java', 'sql', 'docker', 'react'].every((s) => stableLeaning.includes(s)),
  `got ${JSON.stringify(stableLeaning)}`
);

const trendingLeaning = selectPersonalizedSkills(CANDIDATES, 0.8);
check(
  'trending-leaning preference (0.8) picks the 5 highest-stability skills',
  trendingLeaning.length === 5 &&
    ['pytorch', 'llm', 'rag', 'langchain'].every((s) => trendingLeaning.includes(s)),
  `got ${JSON.stringify(trendingLeaning)}`
);

const balanced = selectPersonalizedSkills(CANDIDATES, 0.5);
check('balanced preference (0.5) still returns exactly 5 skills', balanced.length === 5);

// ── selectDynamicSkills — the Focus Skills filter, now separate from core ───────

const DYNAMIC_POOL = [
  { id: 'java', name: 'java', selectedByDefault: true },
  { id: 'sql', name: 'sql', selectedByDefault: true },
  { id: 'docker', name: 'docker', selectedByDefault: true },
  { id: 'kubernetes', name: 'kubernetes', selectedByDefault: true },
  { id: 'react', name: 'react', selectedByDefault: true },
  { id: 'pandas', name: 'pandas', selectedByDefault: false },
  { id: 'pytorch', name: 'pytorch', selectedByDefault: false },
];

const noSelection = selectDynamicSkills(DYNAMIC_POOL, []);
check(
  'no explicit selection -> falls back to the pool\'s own default-selected order',
  JSON.stringify(noSelection) === JSON.stringify(['java', 'sql', 'docker', 'kubernetes', 'react']),
  `got ${JSON.stringify(noSelection)}`
);

const explicitFocus = selectDynamicSkills(DYNAMIC_POOL, ['pytorch', 'pandas']);
check(
  'explicit selectedSkillIds win their slots first, remaining filled from defaults',
  explicitFocus[0] === 'pytorch' &&
    explicitFocus[1] === 'pandas' &&
    explicitFocus.length === 5,
  `got ${JSON.stringify(explicitFocus)}`
);

const fullExplicitFocus = selectDynamicSkills(DYNAMIC_POOL, [
  'kubernetes', 'react', 'pandas', 'pytorch', 'java',
]);
check(
  '5 explicit selectedSkillIds are returned as-is, ignoring default order',
  fullExplicitFocus.length === 5 &&
    ['kubernetes', 'react', 'pandas', 'pytorch', 'java'].every((s) => fullExplicitFocus.includes(s))
);

console.log(failures ? `\n${failures} test(s) FAILED.` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);
