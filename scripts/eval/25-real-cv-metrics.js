/**
 * Turn 24-real-cv-corpus.jsonl into the numbers the book can cite.
 *
 * Two tiers, kept apart on purpose.
 *
 * TIER 1 - label-free. Computed always. These are the numbers that make the
 * real corpus worth reporting: they measure whether the pipeline survives
 * documents nobody on the team produced, which the designed fixtures cannot
 * test because they all come off the same renderer.
 *
 * TIER 2 - accuracy. Computed ONLY if 24-real-cv-labels.csv exists and has
 * true_title filled in. Rows left blank are counted as unlabelled and reported
 * as such; they are never quietly dropped from the denominator, because a
 * denominator that shrinks when labelling gets tedious is how accuracy figures
 * drift upward without anybody lying.
 *
 * Usage:
 *   node scripts/eval/25-real-cv-metrics.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const IN_JSONL = path.join(RAW_DIR, '24-real-cv-corpus.jsonl');
const IN_SHEET = path.join(RAW_DIR, '24-real-cv-labels.csv');
const OUT = '25-real-cv-metrics.json';

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

function tally(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] == null ? '(none)' : String(r[key]);
    out[k] = (out[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function readLabels() {
  if (!fs.existsSync(IN_SHEET)) return null;
  const lines = fs.readFileSync(IN_SHEET, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim());
  const iId = head.indexOf('id');
  const iTrue = head.indexOf('true_title');
  if (iId < 0 || iTrue < 0) return null;
  const map = {};
  for (const line of lines.slice(1)) {
    // Naive split is safe here: the sheet is machine-written and role titles
    // in the taxonomy contain no commas except "Technical Product Manager
    // (TPM)", which has none either.
    const cells = line.split(',');
    const t = (cells[iTrue] || '').trim();
    if (cells[iId]) map[cells[iId].trim()] = t;
  }
  return map;
}

function main() {
  if (!fs.existsSync(IN_JSONL)) {
    console.error('missing', IN_JSONL, '- run 24-real-cv-corpus.js first');
    process.exit(1);
  }
  const rows = fs
    .readFileSync(IN_JSONL, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));

  const ok = rows.filter((r) => r.extracted);
  const refused = rows.filter((r) => !r.extracted);

  const report = {
    generatedAt: new Date().toISOString(),
    corpus: { n: rows.length, note: 'collected real CVs, no ground truth assumed' },

    extraction: {
      succeeded: ok.length,
      refused: refused.length,
      rate_pct: pct(ok.length, rows.length),
      refusals_by_guard: tally(refused, 'guard'),
    },

    // The authenticity signal, and the reason this corpus tests something the
    // fixtures cannot: a spread of producers means a spread of PDF text layers.
    producers: {
      distinct: new Set(rows.map((r) => r.producer)).size,
      breakdown: tally(rows, 'producer'),
    },

    ladder: {
      by_rung: tally(ok, 'ladder_source'),
      served_source: tally(ok, 'served_source'),
      low_confidence: ok.filter((r) => r.low_confidence === true).length,
      low_confidence_pct: pct(ok.filter((r) => r.low_confidence === true).length, ok.length),
    },

    roles_detected: {
      distinct: new Set(ok.map((r) => r.served_title).filter(Boolean)).size,
      breakdown: tally(ok, 'served_title'),
    },

    text: {
      median_chars: median(ok.map((r) => r.chars).filter((n) => typeof n === 'number')),
      min_chars: Math.min(...ok.map((r) => r.chars ?? Infinity)),
      max_chars: Math.max(...ok.map((r) => r.chars ?? -Infinity)),
    },
  };

  const labels = readLabels();
  if (!labels) {
    report.accuracy = {
      status: 'not measured',
      why: 'no 24-real-cv-labels.csv - run 24-real-cv-corpus.js --sheet and fill in true_title',
    };
  } else {
    const labelled = ok.filter((r) => labels[r.id]);
    const hit = labelled.filter((r) => r.served_title === labels[r.id]).length;
    report.accuracy = {
      status: labelled.length === ok.length ? 'complete' : 'partial',
      labelled: labelled.length,
      unlabelled: ok.length - labelled.length,
      top1: hit,
      top1_pct: pct(hit, labelled.length),
      top3: labelled.filter(
        (r) => (r.suggestions || []).includes(labels[r.id]) || r.served_title === labels[r.id]
      ).length,
      misses: labelled
        .filter((r) => r.served_title !== labels[r.id])
        .map((r) => ({ id: r.id, expected: labels[r.id], got: r.served_title })),
    };
  }

  writeRaw(OUT, report);
  console.log(JSON.stringify(report, null, 2));
  console.log('\nwritten:', path.join(RAW_DIR, OUT));
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

main();
