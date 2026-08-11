/**
 * Steps 12-14 (the parts that do not need human labels).
 *
 * Three measurements, all objective:
 *
 * 1. BAND SEPARATION - a weak but real ground truth that exists before any
 *    annotation: within one CV, a matched posting should score above a
 *    mismatched one. This does not require knowing the *right* score, only the
 *    right ORDER, so it is immune to annotator disagreement.
 * 2. TEST-RETEST STABILITY - same pair, same fixed skill list, repeated through
 *    /analyze/rescore. Answers "the LLM is not deterministic, why trust it?"
 *    with a number instead of a shrug.
 * 3. KEYWORD BASELINE - the same skills scored by token overlap. If the LLM
 *    cannot beat this, the architecture does not justify itself.
 *
 * Usage: node scripts/eval/13-scoring-analysis.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const rows = fs
  .readFileSync(path.join(RAW_DIR, '11-pair-scores.jsonl'), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l))
  .filter((r) => !r.error);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const r2 = (x) => Math.round(x * 100) / 100;

// ── 1. band separation ───────────────────────────────────────────────────────
const byCv = {};
for (const r of rows) {
  byCv[r.cv_file] = byCv[r.cv_file] || {};
  byCv[r.cv_file][r.band] = r.matchScore;
}
const bandMeans = {};
for (const band of ['matched', 'adjacent', 'mismatched']) {
  bandMeans[band] = r2(mean(rows.filter((r) => r.band === band).map((r) => r.matchScore)));
}

const comparisons = Object.entries(byCv)
  .filter(([, b]) => b.matched != null && b.mismatched != null)
  .map(([cv, b]) => ({
    cv,
    matched: b.matched,
    adjacent: b.adjacent,
    mismatched: b.mismatched,
    correctOrder: b.matched > b.mismatched,
    tie: b.matched === b.mismatched,
    margin: r2(b.matched - b.mismatched),
  }));
const correct = comparisons.filter((c) => c.correctOrder).length;
const ties = comparisons.filter((c) => c.tie).length;

// ── 2. test-retest ───────────────────────────────────────────────────────────
const retest = rows
  .filter((r) => Array.isArray(r.retest) && r.retest.length > 1)
  .map((r) => {
    const scores = [r.matchScore, ...r.retest.map((t) => t.matchScore)];
    return {
      pair_id: r.pair_id,
      cv: r.cv_file,
      band: r.band,
      scores,
      sd: r2(sd(scores)),
      range: r2(Math.max(...scores) - Math.min(...scores)),
    };
  });

// ── 3. keyword baseline ──────────────────────────────────────────────────────
const perSkill = rows.flatMap((r) =>
  r.skills.map((s) => ({ band: r.band, llm: s.score, kw: s.keywordBaseline }))
);
const llmMean = r2(mean(perSkill.map((s) => s.llm)));
const kwMean = r2(mean(perSkill.map((s) => s.kw)));
const agreeWithin2 = perSkill.filter((s) => Math.abs(s.llm - s.kw) <= 2).length;
const llmZero = perSkill.filter((s) => s.llm === 0).length;
const kwZero = perSkill.filter((s) => s.kw === 0).length;

const summary = {
  pairs: rows.length,
  bandMeans,
  separation: {
    comparisons: comparisons.length,
    matchedAboveMismatched: correct,
    ties,
    inversions: comparisons.length - correct - ties,
    meanMargin: r2(mean(comparisons.map((c) => c.margin))),
  },
  stability: {
    n: retest.length,
    meanSd: r2(mean(retest.map((r) => r.sd))),
    maxSd: r2(Math.max(...retest.map((r) => r.sd))),
    meanRange: r2(mean(retest.map((r) => r.range))),
    maxRange: r2(Math.max(...retest.map((r) => r.range))),
  },
  baseline: {
    skillRatings: perSkill.length,
    llmMean,
    keywordMean: kwMean,
    withinTwoPoints: `${agreeWithin2}/${perSkill.length}`,
    llmZeros: llmZero,
    keywordZeros: kwZero,
  },
};

console.log('=== scoring agent: objective measurements (no human labels yet) ===\n');
console.log(`pairs scored: ${rows.length}\n`);

console.log('1. BAND SEPARATION (does a matched posting outscore a mismatched one?)');
console.log(`   mean matchScore  matched ${bandMeans.matched}  adjacent ${bandMeans.adjacent}  mismatched ${bandMeans.mismatched}`);
console.log(`   within-CV order correct: ${correct}/${comparisons.length}  (ties ${ties}, inversions ${summary.separation.inversions})`);
console.log(`   mean margin matched - mismatched: ${summary.separation.meanMargin} points\n`);
for (const c of comparisons) {
  const flag = c.correctOrder ? '   ' : c.tie ? 'TIE' : 'INV';
  console.log(`   ${flag} ${c.cv.slice(0, 40).padEnd(41)} matched ${String(c.matched).padStart(4)}  adjacent ${String(c.adjacent).padStart(4)}  mismatched ${String(c.mismatched).padStart(4)}`);
}

console.log('\n2. TEST-RETEST STABILITY (same pair, fixed skill list, repeated)');
console.log(`   mean sd ${summary.stability.meanSd} points, max sd ${summary.stability.maxSd}`);
console.log(`   mean range ${summary.stability.meanRange}, max range ${summary.stability.maxRange}`);
const worst = [...retest].sort((a, b) => b.sd - a.sd).slice(0, 3);
for (const w of worst) console.log(`   widest: ${w.cv.slice(0, 38).padEnd(39)} ${w.band.padEnd(10)} ${w.scores.join(', ')}`);

console.log('\n3. KEYWORD BASELINE vs LLM (per skill rating)');
console.log(`   n=${perSkill.length}  LLM mean ${llmMean}  keyword mean ${kwMean}`);
console.log(`   within 2 points of each other: ${agreeWithin2}/${perSkill.length}`);
console.log(`   zero scores: LLM ${llmZero}, keyword ${kwZero}`);

console.log('\nwritten:', writeRaw('13-scoring-analysis.json', { summary, comparisons, retest }));
