/**
 * Step 3 / 3ג' of the M05 plan: push every authentic CV through the REAL
 * pipeline (multipart upload -> PDF text extraction -> title ladder) and record
 * the raw result for offline metric computation.
 *
 * Two endpoints are captured per CV:
 *   /api/cv/extract-title - ladder-level truth: source ('title_extraction' vs
 *                           'cv_classifier'), low_confidence, candidates, and
 *                           the M19 agreement fields. Calibration needs this.
 *   /api/cv/title         - what the frontend actually receives (suggestion-level
 *                           source enum + top-3 suggestions).
 *
 * Negative fixtures (Hebrew, scanned) are EXPECTED to fail at upload - that is
 * the M14 English-only / <50-char guard doing its job. The failure is recorded
 * as an outcome, never swallowed and never treated as a crash.
 *
 * Usage:
 *   node scripts/eval/01-title-benchmark.js --tag on            # full 32
 *   node scripts/eval/01-title-benchmark.js --tag on --limit 2  # smoke
 */
const {
  login,
  uploadPdf,
  extractTitle,
  detectTitle,
  loadManifest,
  pdfPath,
  appendRawLine,
  RAW_DIR,
} = require('./common');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { tag: 'on', limit: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--tag') out.tag = args[i + 1];
    if (args[i] === '--limit') out.limit = Number(args[i + 1]);
  }
  return out;
}

async function main() {
  const { tag, limit } = parseArgs();
  const outFile = `01-title-benchmark-${tag}.jsonl`;
  const outPath = path.join(RAW_DIR, outFile);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const manifest = loadManifest();
  const cvs = limit ? manifest.cvs.slice(0, limit) : manifest.cvs;

  console.log(`M05 title benchmark - signal tag: ${tag} - ${cvs.length} CVs`);
  const token = await login();

  let ok = 0;
  let guarded = 0;
  for (const [i, cv] of cvs.entries()) {
    const started = Date.now();
    const row = {
      file: cv.file,
      true_title: cv.true_title,
      acceptable_titles: cv.acceptable_titles,
      scenario: cv.scenario,
      seniority: cv.seniority,
      strength: cv.strength,
      is_negative_fixture: cv.is_negative_fixture,
      signal_tag: tag,
    };

    try {
      const uploaded = await uploadPdf(token, pdfPath(cv.file));
      row.upload = {
        ok: true,
        cvTextLen: (uploaded.cvText || '').length,
        headerTextLen: (uploaded.headerText || '').length,
      };

      const ladder = await extractTitle(token, uploaded.cvText, uploaded.headerText);
      row.ladder = {
        extracted_title: ladder.extracted_title,
        canonical_title: ladder.canonical_title,
        confidence: ladder.confidence,
        low_confidence: ladder.low_confidence,
        source: ladder.source,
        agreement: ladder.agreement,
        skills_model_title: ladder.skills_model_title,
        skills_model_confidence: ladder.skills_model_confidence,
        candidates: ladder.candidates,
      };

      const product = await detectTitle(token, uploaded.cvText, uploaded.headerText);
      row.product = {
        detectedTitle: product.detectedTitle,
        confidence: product.confidence,
        source: product.source,
        suggestions: product.suggestions,
      };

      ok += 1;
    } catch (err) {
      const res = err.response;
      row.error = {
        stage: row.upload ? 'title' : 'upload',
        status: res ? res.status : null,
        body: res ? res.data : err.message,
      };
      // An upload rejection on a negative fixture is the guard working.
      if (cv.is_negative_fixture && !row.upload) guarded += 1;
    }

    row.elapsedMs = Date.now() - started;
    appendRawLine(outFile, row);

    const label = row.error
      ? `ERR(${row.error.status || 'net'}) ${row.error.stage}`
      : `${row.product.detectedTitle} @${row.product.confidence} [${row.ladder.source}${row.ladder.agreement ? '/' + row.ladder.agreement : ''}]`;
    console.log(`  ${String(i + 1).padStart(2)}/${cvs.length} ${cv.file.padEnd(52)} ${label}`);
  }

  console.log(`\ndone: ${ok} detected, ${cvs.length - ok} errored (${guarded} = negative-fixture guards)`);
  console.log('raw:', outPath);
}

main().catch((err) => {
  console.error('benchmark failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
