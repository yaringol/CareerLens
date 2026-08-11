/**
 * Step 3ב': title-redaction ablation.
 *
 * The 32 authentic CVs are header-dominated - 26/29 resolve on the LLM
 * title-extraction rung, so /cv/role (where the M19 agreement signal lives)
 * barely runs. To measure the signal on real CVs instead of two synthetic ones,
 * each CV is re-sent with its declared title removed.
 *
 * Why removal and not "send no headerText": extractSelfDeclaredTitle reads
 * `headerText || cvText` (dsModel.ts:366), so dropping headerText alone just
 * makes the LLM read the title out of cvText and the classifier path is never
 * reached. Both fields are redacted, and every row is checked - a row whose
 * source is still 'title_extraction' is EXCLUDED and reported, because the
 * ablation did not take.
 *
 * This is a declared synthetic ablation: real CVs with the title hidden, not
 * naturally title-less CVs. Reported as such.
 *
 * Usage: node scripts/eval/04-header-ablation.js --tag on
 */
const fs = require('fs');
const path = require('path');
const {
  login, uploadPdf, extractTitle, loadManifest, pdfPath, appendRawLine, RAW_DIR,
} = require('./common');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { tag: 'on', limit: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--tag') out.tag = args[i + 1];
    if (args[i] === '--limit') out.limit = Number(args[i + 1]);
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Strings to strip: the ground-truth title, the title the ladder actually
 * extracted on the unmodified run, and their word-level pieces (so "Senior
 * Backend Developer, Tech Lead" also kills a bare "Backend Developer").
 */
function redactionTerms(trueTitle, extractedTitle) {
  const terms = new Set();
  for (const src of [trueTitle, extractedTitle]) {
    if (!src || src.toLowerCase() === 'none') continue;
    terms.add(src);
    for (const piece of src.split(/[,/|()–-]/)) {
      const p = piece.trim();
      if (p.length >= 4) terms.add(p);
    }
  }
  // Longest first so a superstring is removed before its fragments.
  return [...terms].sort((a, b) => b.length - a.length);
}

const redact = (text, terms) => {
  let out = text || '';
  for (const t of terms) out = out.replace(new RegExp(escapeRe(t), 'gi'), ' ');
  return out.replace(/\s{2,}/g, ' ').trim();
};

async function main() {
  const { tag, limit } = parseArgs();
  const outFile = `04-header-ablation-${tag}.jsonl`;
  const outPath = path.join(RAW_DIR, outFile);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  // The unmodified run supplies each CV's actually-extracted title.
  const baseRows = fs
    .readFileSync(path.join(RAW_DIR, '01-title-benchmark-on.jsonl'), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l));
  const extractedByFile = new Map(
    baseRows.map((r) => [r.file, r.ladder ? r.ladder.extracted_title : null])
  );

  const manifest = loadManifest();
  let cvs = manifest.cvs.filter((c) => !c.is_negative_fixture);
  if (limit) cvs = cvs.slice(0, limit);

  console.log(`title-redaction ablation - signal tag: ${tag} - ${cvs.length} CVs`);
  const token = await login();

  let took = 0;
  let didNotTake = 0;
  for (const [i, cv] of cvs.entries()) {
    const row = {
      file: cv.file,
      true_title: cv.true_title,
      acceptable_titles: cv.acceptable_titles,
      scenario: cv.scenario,
      signal_tag: tag,
    };
    try {
      const up = await uploadPdf(token, pdfPath(cv.file));
      const terms = redactionTerms(cv.true_title, extractedByFile.get(cv.file));
      const cvText = redact(up.cvText, terms);
      row.redaction = { terms, removedChars: (up.cvText || '').length - cvText.length };

      const ladder = await extractTitle(token, cvText, '');
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
      // The ablation only counts when the classifier path was actually reached.
      row.ablationTook = ladder.source === 'cv_classifier';
      if (row.ablationTook) took += 1; else didNotTake += 1;
    } catch (err) {
      const res = err.response;
      row.error = { status: res ? res.status : null, body: res ? res.data : err.message };
    }
    appendRawLine(outFile, row);
    const label = row.error
      ? `ERR ${row.error.status}`
      : `${row.ablationTook ? 'OK ' : 'SKIP'} ${row.ladder.canonical_title} @${row.ladder.confidence} [${row.ladder.source}/${row.ladder.agreement || '-'}]`;
    console.log(`  ${String(i + 1).padStart(2)}/${cvs.length} ${cv.file.slice(0, 46).padEnd(47)} ${label}`);
  }

  console.log(`\nablation took on ${took}/${cvs.length}; ${didNotTake} still resolved by title extraction (excluded)`);
  console.log('raw:', outPath);
}

main().catch((err) => {
  console.error('ablation failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
