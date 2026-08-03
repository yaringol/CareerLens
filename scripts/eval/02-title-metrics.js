/**
 * Step 4: compute model-2 metrics offline from a benchmark JSONL.
 *
 * Scoring rules (fixed here, deliberately, so they cannot drift per-run):
 *  - Negative fixtures (is_negative_fixture) are EXCLUDED from accuracy and
 *    reported separately as guard behaviour - manifest.json:5 mandates this.
 *  - true_title === 'none' (non-negative): success means the system did NOT
 *    auto-accept a role, i.e. confidence < AUTO_MATCH (60). Detecting something
 *    with low confidence is correct behaviour; auto-matching is the failure.
 *  - Otherwise: top-1 = ladder canonical_title in acceptable_titles;
 *    top-3 = any of the ladder's top-3 candidates in acceptable_titles.
 *  - Pipeline errors (5xx) are scored as failures AND reported separately: a
 *    crash is a bug to report, not a row to drop.
 *
 * Usage: node scripts/eval/02-title-metrics.js [--tag on]
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const AUTO_MATCH = 60; // frontend AUTO_MATCH_CONFIDENCE_MIN (CvUploadSection.tsx:40)
const LLM_THRESHOLD = 55; // backend TITLE_LLM_FALLBACK_THRESHOLD default (dsModel.ts:20)

const tagArg = process.argv.indexOf('--tag');
const tag = tagArg > -1 ? process.argv[tagArg + 1] : 'on';

const rows = fs
  .readFileSync(path.join(RAW_DIR, `01-title-benchmark-${tag}.jsonl`), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));

const norm = (s) => (s || '').trim().toLowerCase();

function scoreRow(r) {
  const acceptable = (r.acceptable_titles || []).map(norm);
  const isNone = norm(r.true_title) === 'none';

  if (r.error) {
    return { scored: true, top1: false, top3: false, errored: true, autoAccepted: false };
  }

  const canonical = norm(r.ladder.canonical_title);
  const conf = r.ladder.confidence;
  const autoAccepted = conf >= AUTO_MATCH;
  const cands = (r.ladder.candidates || []).slice(0, 3).map((c) => norm(c.canonical_title));

  if (isNone) {
    // Correct = not presented as a confident match.
    return { scored: true, top1: !autoAccepted, top3: !autoAccepted, errored: false, autoAccepted };
  }
  return {
    scored: true,
    top1: acceptable.includes(canonical),
    top3: cands.some((c) => acceptable.includes(c)),
    errored: false,
    autoAccepted,
  };
}

const guards = rows.filter((r) => r.is_negative_fixture);
const scored = rows.filter((r) => !r.is_negative_fixture);

const results = scored.map((r) => ({ row: r, ...scoreRow(r) }));

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : 'n/a');
const count = (arr, f) => arr.filter(f).length;

const summary = {
  tag,
  generatedAt: new Date().toISOString(),
  thresholds: { auto_match: AUTO_MATCH, llm_fallback: LLM_THRESHOLD },
  overall: {
    n: results.length,
    top1: count(results, (r) => r.top1),
    top3: count(results, (r) => r.top3),
    errors: count(results, (r) => r.errored),
  },
  byScenario: {},
  bySource: {},
  guards: {
    n: guards.length,
    allBlocked: guards.every((g) => g.error),
    detail: guards.map((g) => ({
      file: g.file,
      status: g.error ? g.error.status : null,
      message: g.error ? (g.error.body.error || g.error.body) : 'NOT BLOCKED',
    })),
  },
  errorRows: results
    .filter((r) => r.errored)
    .map((r) => ({
      file: r.row.file,
      stage: r.row.error.stage,
      status: r.row.error.status,
      body: r.row.error.body,
    })),
};

for (const r of results) {
  const s = r.row.scenario;
  summary.byScenario[s] = summary.byScenario[s] || { n: 0, top1: 0, top3: 0, errors: 0 };
  summary.byScenario[s].n += 1;
  if (r.top1) summary.byScenario[s].top1 += 1;
  if (r.top3) summary.byScenario[s].top3 += 1;
  if (r.errored) summary.byScenario[s].errors += 1;
}

// Calibration must be split by source: title_extraction confidence is a cosine
// similarity x100, cv_classifier is a renormalised softmax share, llm_fallback
// is the constant 70. Pooling them calibrates one threshold over three scales.
for (const r of results) {
  if (r.errored) continue;
  const src = r.row.ladder.source || 'unknown';
  summary.bySource[src] = summary.bySource[src] || {
    n: 0, top1: 0, confidences: [], autoAccepted: 0,
  };
  const b = summary.bySource[src];
  b.n += 1;
  if (r.top1) b.top1 += 1;
  if (r.autoAccepted) b.autoAccepted += 1;
  b.confidences.push(r.row.ladder.confidence);
}
for (const b of Object.values(summary.bySource)) {
  const c = b.confidences.slice().sort((x, y) => x - y);
  b.confidenceMin = c[0];
  b.confidenceMedian = c[Math.floor(c.length / 2)];
  b.confidenceMax = c[c.length - 1];
  delete b.confidences;
}

// Agreement-signal reach on this (header-dominated) set.
summary.agreement = results.reduce((acc, r) => {
  if (r.errored) return acc;
  const a = r.row.ladder.agreement || 'absent (extraction path)';
  acc[a] = (acc[a] || 0) + 1;
  return acc;
}, {});

const out = writeRaw(`02-title-metrics-${tag}.json`, summary);

console.log(`\n=== M05 model-2 benchmark (tag: ${tag}) ===`);
console.log(`scored CVs: ${summary.overall.n}  (3 negative fixtures excluded)`);
console.log(`Top-1: ${summary.overall.top1}/${summary.overall.n} (${pct(summary.overall.top1, summary.overall.n)})`);
console.log(`Top-3: ${summary.overall.top3}/${summary.overall.n} (${pct(summary.overall.top3, summary.overall.n)})`);
console.log(`pipeline errors: ${summary.overall.errors}`);

console.log('\nby scenario:');
for (const [s, v] of Object.entries(summary.byScenario)) {
  console.log(`  ${s.padEnd(16)} n=${String(v.n).padStart(2)}  top1 ${String(v.top1).padStart(2)} (${pct(v.top1, v.n)})  top3 ${String(v.top3).padStart(2)}  err ${v.errors}`);
}

console.log('\nby source (calibration is per-source, never pooled):');
for (const [s, v] of Object.entries(summary.bySource)) {
  console.log(`  ${s.padEnd(18)} n=${String(v.n).padStart(2)}  top1 ${pct(v.top1, v.n).padStart(6)}  conf ${v.confidenceMin}..${v.confidenceMax} (med ${v.confidenceMedian})  auto-accepted ${v.autoAccepted}/${v.n}`);
}

console.log('\nagreement signal reach:');
for (const [k, v] of Object.entries(summary.agreement)) console.log(`  ${k.padEnd(28)} ${v}`);

console.log('\nnegative-fixture guards:');
for (const g of summary.guards.detail) console.log(`  ${g.file.padEnd(34)} ${g.status} - ${g.message}`);

if (summary.errorRows.length) {
  console.log('\nPIPELINE ERRORS (bugs, not dropped rows):');
  for (const e of summary.errorRows) console.log(`  ${e.file} [${e.stage}] ${e.status} ${JSON.stringify(e.body)}`);
}
console.log('\nwritten:', out);
