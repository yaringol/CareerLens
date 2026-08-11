/**
 * Compare two benchmark runs row-by-row. Used to prove a change is
 * behaviour-preserving (M19/W6) and, later, for the ON/OFF signal ablation.
 *
 * Usage: node scripts/eval/03-compare-runs.js <baseline.jsonl> <candidate.jsonl>
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR } = require('./common');

const [baseFile, candFile] = process.argv.slice(2);
if (!baseFile || !candFile) {
  console.error('usage: node scripts/eval/03-compare-runs.js <baseline.jsonl> <candidate.jsonl>');
  process.exit(1);
}

const read = (f) =>
  fs
    .readFileSync(path.isAbsolute(f) ? f : path.join(RAW_DIR, f), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

const byFile = (rows) => new Map(rows.map((r) => [r.file, r]));
const base = byFile(read(baseFile));
const cand = byFile(read(candFile));

const outcome = (r) => {
  if (r.error) return `ERR ${r.error.status} @${r.error.stage}`;
  return `${r.ladder.canonical_title} @${r.ladder.confidence} [${r.ladder.source}]`;
};

let same = 0;
const diffs = [];
for (const [file, b] of base) {
  const c = cand.get(file);
  if (!c) {
    diffs.push({ file, kind: 'missing in candidate' });
    continue;
  }
  const ob = outcome(b);
  const oc = outcome(c);
  if (ob === oc) {
    same += 1;
  } else {
    diffs.push({
      file,
      kind: 'outcome',
      baseline: ob,
      candidate: oc,
      baselineAgreement: b.ladder ? b.ladder.agreement : null,
      candidateAgreement: c.ladder ? c.ladder.agreement : null,
    });
  }
}

const ms = (rows) => {
  const v = [...rows.values()].map((r) => r.elapsedMs).sort((a, b) => a - b);
  return { median: v[Math.floor(v.length / 2)], max: v[v.length - 1] };
};

console.log(`identical outcomes: ${same}/${base.size}`);
console.log(`baseline  latency: median ${ms(base).median}ms, max ${ms(base).max}ms`);
console.log(`candidate latency: median ${ms(cand).median}ms, max ${ms(cand).max}ms`);

if (diffs.length) {
  console.log(`\ndifferences (${diffs.length}):`);
  for (const d of diffs) {
    if (d.kind !== 'outcome') {
      console.log(`  ${d.file}: ${d.kind}`);
      continue;
    }
    console.log(`  ${d.file}`);
    console.log(`     baseline : ${d.baseline}  (agreement: ${d.baselineAgreement})`);
    console.log(`     candidate: ${d.candidate}  (agreement: ${d.candidateAgreement})`);
  }
} else {
  console.log('\nno differences.');
}
