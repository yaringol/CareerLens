/**
 * Verdict for the agreement signal: compare the ON and OFF ablation runs.
 *
 * Scoring follows 02-title-metrics.js: for true_title 'none', success means the
 * system did NOT auto-accept; otherwise top-1 must land in acceptable_titles.
 * Every CV is also classified by how the signal touched it, so a change in
 * accuracy can be attributed rather than just observed.
 *
 * Usage: node scripts/eval/06-signal-verdict.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const read = (f) =>
  fs.readFileSync(path.join(RAW_DIR, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const on = new Map(read('05-signal-ablation-on.jsonl').map((r) => [r.file, r]));
const off = new Map(read('05-signal-ablation-off.jsonl').map((r) => [r.file, r]));

const norm = (s) => (s || '').trim().toLowerCase();

function correct(row) {
  if (row.error) return false;
  const isNone = norm(row.true_title) === 'none';
  if (isNone) return !row.decision.autoAccepted;
  return (row.acceptable_titles || []).map(norm).includes(norm(row.result.canonical_title));
}

const rows = [];
for (const [file, o] of on) {
  const f = off.get(file);
  if (!f) continue;
  rows.push({
    file,
    scenario: o.scenario,
    true_title: o.true_title,
    agreement: o.result ? o.result.agreement : null,
    offTitle: f.result ? f.result.canonical_title : null,
    offConf: f.result ? f.result.confidence : null,
    onTitle: o.result ? o.result.canonical_title : null,
    onConf: o.result ? o.result.confidence : null,
    offCorrect: correct(f),
    onCorrect: correct(o),
    offAuto: f.decision ? f.decision.autoAccepted : null,
    onAuto: o.decision ? o.decision.autoAccepted : null,
    offLlm: f.decision ? f.decision.llmFallbackFires : null,
    onLlm: o.decision ? o.decision.llmFallbackFires : null,
  });
}

const n = rows.length;
const sum = (f) => rows.filter(f).length;

const summary = {
  n,
  accuracy: { off: sum((r) => r.offCorrect), on: sum((r) => r.onCorrect) },
  autoAccepted: { off: sum((r) => r.offAuto), on: sum((r) => r.onAuto) },
  llmFallback: { off: sum((r) => r.offLlm), on: sum((r) => r.onLlm) },
  agreementDistribution: rows.reduce((a, r) => {
    a[r.agreement || 'none'] = (a[r.agreement || 'none'] || 0) + 1;
    return a;
  }, {}),
  helped: rows.filter((r) => !r.offCorrect && r.onCorrect),
  harmed: rows.filter((r) => r.offCorrect && !r.onCorrect),
  confidenceChanged: rows.filter((r) => r.offConf !== r.onConf),
};

const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

console.log(`=== agreement signal: ON vs OFF on ${n} authentic CVs (direct /cv/role) ===\n`);
console.log(`accuracy      OFF ${summary.accuracy.off}/${n} (${pct(summary.accuracy.off)})   ON ${summary.accuracy.on}/${n} (${pct(summary.accuracy.on)})`);
console.log(`auto-accepted OFF ${summary.autoAccepted.off}/${n}   ON ${summary.autoAccepted.on}/${n}`);
console.log(`LLM fallback  OFF ${summary.llmFallback.off}/${n}   ON ${summary.llmFallback.on}/${n}`);

console.log('\nsignal reach:');
for (const [k, v] of Object.entries(summary.agreementDistribution)) {
  console.log(`  ${k.padEnd(26)} ${v}`);
}

console.log(`\nconfidence changed on ${summary.confidenceChanged.length} CVs:`);
for (const r of summary.confidenceChanged) {
  const verdict = !r.offCorrect && r.onCorrect ? 'HELPED'
    : r.offCorrect && !r.onCorrect ? 'HARMED' : 'neutral';
  console.log(`  ${r.file.slice(0, 44).padEnd(45)} ${r.agreement.padEnd(10)} ${String(r.offConf).padStart(6)} -> ${String(r.onConf).padStart(6)}  auto ${r.offAuto ? 'Y' : 'N'}->${r.onAuto ? 'Y' : 'N'}  ${verdict}`);
  console.log(`      true: ${r.true_title} | off: ${r.offTitle} | on: ${r.onTitle}`);
}

console.log(`\nhelped: ${summary.helped.length}   harmed: ${summary.harmed.length}`);
console.log('written:', writeRaw('06-signal-verdict.json', { summary, rows }));
