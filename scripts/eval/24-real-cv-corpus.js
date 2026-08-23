/**
 * Run a directory of REAL, collected CVs through the production pipeline.
 *
 * This is the counterpart to 01-title-benchmark.js. That harness measures the
 * 32 designed fixtures, which carry pinned ground truth in manifest.json. This
 * one measures documents nobody on the team wrote: real CVs collected from real
 * people, in whatever shape they arrived.
 *
 * The two corpora answer different questions and neither replaces the other.
 * The fixtures answer "is the answer correct", because their labels are known.
 * This corpus answers "does the system survive the wild" - which producers, which
 * layouts, which encodings, which lengths - and it is the harder question for a
 * PDF pipeline. Collected CVs in this set arrive from 19 different PDF producers
 * (Canva, Word 2016 and 2024, pdfTeX, macOS Preview, Google Docs, jsPDF, six
 * Chrome versions, and more); the fixtures all arrive from one.
 *
 * NO GROUND TRUTH IS ASSUMED. Every metric this script produces is label-free
 * and can be cited without anybody labelling anything:
 *
 *   - extraction: how many PDFs yield usable text through the real upload path
 *   - guards: how many are refused, and by which guard
 *   - ladder: which rung resolved each CV (declared title / classifier)
 *   - confidence: the served distribution, and the auto-accept rate
 *   - coverage: which of the 59 canonical roles the corpus actually lands on
 *
 * It also writes a labelling sheet (--sheet) so that accuracy CAN be computed
 * later: fill in true_title per row, then run 25-real-cv-metrics.js. Until that
 * sheet is filled in, no accuracy number exists and none is invented.
 *
 * PRIVACY. Real CVs carry real names, phone numbers and addresses. This script
 * reads them from a path OUTSIDE the repository and never copies document text
 * into its output. Rows are keyed by a short hash of the filename; the
 * filename-to-hash map is written next to the results and is gitignored. Do not
 * commit the corpus, and do not paste CV text into the book.
 *
 * Usage:
 *   node scripts/eval/24-real-cv-corpus.js --dir "c:/Users/may20/Downloads/resume"
 *   node scripts/eval/24-real-cv-corpus.js --dir <path> --limit 3     # smoke test
 *   node scripts/eval/24-real-cv-corpus.js --dir <path> --sheet       # + labelling sheet
 *
 * Requires the stack to be up (backend on API_URL, DS on DS_MODEL_URL).
 */
const {
  login,
  uploadPdf,
  extractTitle,
  detectTitle,
  appendRawLine,
  writeRaw,
  RAW_DIR,
} = require('./common');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_JSONL = '24-real-cv-corpus.jsonl';
const OUT_MAP = '24-real-cv-filemap.local.json';
const OUT_SHEET = '24-real-cv-labels.csv';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dir: null, limit: null, sheet: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--dir') out.dir = args[i + 1];
    if (args[i] === '--limit') out.limit = Number(args[i + 1]);
    if (args[i] === '--sheet') out.sheet = true;
  }
  if (!out.dir) {
    console.error('--dir <path to folder of PDFs> is required');
    process.exit(1);
  }
  return out;
}

/** Stable, short, non-reversible id so results can be discussed without names. */
const idOf = (file) => crypto.createHash('sha1').update(file).digest('hex').slice(0, 8);

/**
 * Which tool wrote the PDF. This is the single most telling authenticity signal
 * a collected corpus has - a spread of producers cannot be manufactured by
 * rendering one template repeatedly - and it costs one regex over the raw bytes.
 */
function producerOf(absPath) {
  try {
    const buf = fs.readFileSync(absPath);
    const m = buf.toString('latin1').match(/\/Producer\s*\(([^)]{0,80})\)/);
    if (!m) return 'unknown';
    return m[1].replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  } catch {
    return 'unreadable';
  }
}

/** Classify an upload failure by the guard that produced it, not by status code alone. */
function guardOf(err) {
  const body = err.response && err.response.data;
  const msg = String((body && (body.message || body.error)) || err.message || '');
  if (/english/i.test(msg)) return 'language_guard';
  if (/50|too short|no text|extract/i.test(msg)) return 'no_extractable_text';
  if (/size|large/i.test(msg)) return 'size_limit';
  if (/pdf|format|type/i.test(msg)) return 'format_guard';
  return `other:${(err.response && err.response.status) || 'network'}`;
}

async function main() {
  const { dir, limit, sheet } = parseArgs();
  if (!fs.existsSync(dir)) {
    console.error('directory not found:', dir);
    process.exit(1);
  }

  let files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();
  if (limit) files = files.slice(0, limit);

  const outPath = path.join(RAW_DIR, OUT_JSONL);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  console.log(`real-CV corpus - ${files.length} PDFs from ${dir}`);
  const token = await login();

  const fileMap = {};
  const rows = [];

  for (const [i, file] of files.entries()) {
    const abs = path.join(dir, file);
    const id = idOf(file);
    fileMap[id] = file;

    const row = {
      id,
      producer: producerOf(abs),
      bytes: fs.statSync(abs).size,
    };
    const started = Date.now();

    try {
      const up = await uploadPdf(token, abs);
      row.extracted = true;
      // Lengths only - never the text itself. See the privacy note above.
      row.chars = (up.cvText || '').length;
      row.header_chars = (up.headerText || '').length;

      // Field names follow the two endpoints exactly. /api/cv/extract-title
      // returns the DS-side snake_case result (canonical_title, see
      // ExtractTitleResult in backend/src/services/dsModel.ts), while
      // /api/cv/title returns the frontend-shaped camelCase envelope whose
      // detectedTitle is the matched VARIANT, not the canonical role. The
      // canonical role - the one that indexes the 59-role taxonomy and the one
      // a label has to be compared against - is only on suggestions[0].
      const ladder = await extractTitle(token, up.cvText, up.headerText);
      row.ladder_source = ladder.source;
      row.ladder_title = ladder.canonical_title ?? null;
      // Length only, never the string: a self-declared title is verbatim CV
      // text and can carry an employer or lab name. Whether one was found
      // is already in ladder_source ('title_extraction').
      row.ladder_extracted_chars = (ladder.extracted_title || '').length;
      row.low_confidence = ladder.low_confidence ?? null;
      row.confidence = ladder.confidence ?? null;
      row.agreement = ladder.agreement ?? null;

      const served = await detectTitle(token, up.cvText, up.headerText);
      const servedSuggestions = served.suggestions || [];
      row.served_source = served.source;
      row.served_title = servedSuggestions[0] ? servedSuggestions[0].canonicalTitle : null;
      row.served_variant = served.detectedTitle ?? null;
      row.served_confidence = served.confidence ?? null;
      row.suggestions = servedSuggestions.slice(0, 3).map((s) => s.canonicalTitle);
    } catch (err) {
      row.extracted = false;
      row.guard = guardOf(err);
    }

    row.ms = Date.now() - started;
    appendRawLine(OUT_JSONL, row);
    rows.push(row);

    const mark = row.extracted ? (row.served_title || '(no title)') : `REFUSED ${row.guard}`;
    console.log(`  [${i + 1}/${files.length}] ${id}  ${mark}`);
  }

  // The name map is the only artifact that can identify a person. Keep it local.
  writeRaw(OUT_MAP, fileMap);

  if (sheet) {
    const header = 'id,served_title,ladder_source,confidence,true_title,notes\n';
    const body = rows
      .filter((r) => r.extracted)
      .map((r) =>
        [r.id, r.served_title || '', r.ladder_source || '', r.served_confidence ?? '', '', '']
          .join(',')
      )
      .join('\n');
    fs.writeFileSync(path.join(RAW_DIR, OUT_SHEET), header + body + '\n', 'utf8');
    console.log(`\nlabelling sheet: ${path.join(RAW_DIR, OUT_SHEET)}`);
    console.log('fill in true_title per row, then run 25-real-cv-metrics.js');
  }

  const ok = rows.filter((r) => r.extracted).length;
  console.log(`\nextracted ${ok} of ${rows.length}`);
  console.log(`raw rows : ${outPath}`);
  console.log(`name map : ${path.join(RAW_DIR, OUT_MAP)}  (gitignore this)`);
}

main().catch((err) => {
  console.error(err.response ? err.response.data : err);
  process.exit(1);
});
