/**
 * Step 8: threshold sweep - deployed 60/55 vs the training script's recommended
 * 80/95. Recommendation only; M05 changes no thresholds (user decision).
 *
 * The sweep is offline: a threshold is a decision rule applied to confidences
 * that were already collected, so no re-run is needed.
 *
 * Two things this deliberately keeps apart:
 *  - auto-accept (frontend, 60) decides "show as matched" vs "ask the user".
 *  - llm-fallback (backend, 55) decides whether the closed-list LLM rung fires.
 *  - and both are swept PER SOURCE, because title_extraction confidence is a
 *    cosine similarity x100 while cv_classifier confidence is a renormalised
 *    softmax share. One threshold over two distributions is the original sin
 *    this milestone was asked to examine.
 *
 * Usage: node scripts/eval/09-threshold-sweep.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const read = (f) =>
  fs.readFileSync(path.join(RAW_DIR, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const norm = (s) => (s || '').trim().toLowerCase();

const rows = read('01-title-benchmark-on.jsonl')
  .filter((r) => !r.is_negative_fixture && !r.error)
  .map((r) => ({
    file: r.file,
    scenario: r.scenario,
    trueTitle: r.true_title,
    isNone: norm(r.true_title) === 'none',
    acceptable: (r.acceptable_titles || []).map(norm),
    source: r.ladder.source,
    confidence: r.ladder.confidence,
    predicted: norm(r.ladder.canonical_title),
  }))
  .map((r) => ({ ...r, correct: !r.isNone && r.acceptable.includes(r.predicted) }));

/**
 * At auto-accept threshold T:
 *   autoAccepted      - shown to the user as a match
 *   goodAuto          - of those, actually right (for 'none' CVs, ANY auto-accept is wrong)
 *   missedToManual    - correct detections demoted to the manual picker (the cost of raising T)
 *   badAutoBlocked    - wrong/none auto-accepts that T correctly stops (the benefit)
 */
function evaluate(T, subset) {
  const auto = subset.filter((r) => r.confidence >= T);
  const manual = subset.filter((r) => r.confidence < T);
  return {
    threshold: T,
    n: subset.length,
    autoAccepted: auto.length,
    goodAuto: auto.filter((r) => r.correct).length,
    badAuto: auto.filter((r) => !r.correct).length,
    missedToManual: manual.filter((r) => r.correct).length,
    badAutoBlocked: manual.filter((r) => !r.correct).length,
  };
}

const THRESHOLDS = [55, 60, 70, 80, 90, 95];
const bySource = {};
for (const src of [...new Set(rows.map((r) => r.source))]) {
  bySource[src] = THRESHOLDS.map((T) => evaluate(T, rows.filter((r) => r.source === src)));
}
const overall = THRESHOLDS.map((T) => evaluate(T, rows));

const fmt = (e) =>
  `  T=${String(e.threshold).padStart(3)}  auto ${String(e.autoAccepted).padStart(2)}/${e.n}  correct-auto ${String(e.goodAuto).padStart(2)}  wrong-auto ${String(e.badAuto).padStart(2)}  correct-sent-to-manual ${String(e.missedToManual).padStart(2)}  wrong-blocked ${String(e.badAutoBlocked).padStart(2)}`;

console.log('=== auto-accept threshold sweep (full pipeline, signal ON) ===');
console.log(`\nALL SOURCES POOLED (n=${rows.length}) - shown only to make the point that pooling misleads:`);
overall.forEach((e) => console.log(fmt(e)));

for (const [src, evals] of Object.entries(bySource)) {
  const scale = src === 'title_extraction'
    ? 'cosine similarity x100'
    : src === 'cv_classifier' ? 'renormalised softmax share' : 'constant';
  console.log(`\n${src}  (${scale}, n=${evals[0].n}):`);
  evals.forEach((e) => console.log(fmt(e)));
}

const deployed = overall.find((e) => e.threshold === 60);
const recommended = overall.find((e) => e.threshold === 80);
console.log('\n--- deployed 60 vs recommended 80 (pooled) ---');
console.log(`  60: ${deployed.autoAccepted} auto-accepted, ${deployed.badAuto} of them wrong`);
console.log(`  80: ${recommended.autoAccepted} auto-accepted, ${recommended.badAuto} of them wrong, ` +
  `${recommended.missedToManual - deployed.missedToManual} extra correct detections demoted to manual`);

console.log('\nwritten:', writeRaw('09-threshold-sweep.json', { rows, overall, bySource }));
