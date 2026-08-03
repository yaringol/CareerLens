/**
 * Steps 3ב' + 3ג': measure the M19 agreement signal where it actually lives,
 * and collect a clean classifier-confidence distribution for calibration.
 *
 * Method: call DS /cv/role directly with each CV's unmodified extracted text.
 * That IS the headerless counterfactual - when no title is declared, the
 * backend hands the classifier exactly this text (dsModel.ts:400). No synthetic
 * mutilation of the CV is involved.
 *
 * (The first attempt, 04-header-ablation.js, redacted the declared title to
 * force the product ladder down this rung. It only took on a minority of CVs:
 * the extraction LLM recovers a title from role lines elsewhere in the document.
 * That result is kept as a robustness observation, not as the signal measurement.)
 *
 * The backend's own decision rule is then replayed offline, so ON/OFF can be
 * compared at product level without burning an LLM call per CV:
 *   all candidates < 55  -> the closed-list LLM rung fires (dsModel.ts:134)
 *   top >= 60            -> the UI auto-accepts (CvUploadSection.tsx:40)
 *
 * Run once per DS mode:
 *   node scripts/eval/05-signal-ablation.js --tag on     (AGREEMENT_SIGNAL_ENABLED=1)
 *   node scripts/eval/05-signal-ablation.js --tag off    (AGREEMENT_SIGNAL_ENABLED=0)
 */
const fs = require('fs');
const path = require('path');
const {
  login, uploadPdf, dsCvRole, loadManifest, pdfPath, appendRawLine, RAW_DIR,
} = require('./common');

const LLM_THRESHOLD = 55;
const AUTO_MATCH = 60;

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
  const outFile = `05-signal-ablation-${tag}.jsonl`;
  const outPath = path.join(RAW_DIR, outFile);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const manifest = loadManifest();
  let cvs = manifest.cvs.filter((c) => !c.is_negative_fixture);
  if (limit) cvs = cvs.slice(0, limit);

  console.log(`signal ablation via direct /cv/role - tag: ${tag} - ${cvs.length} CVs`);
  const token = await login();

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
      const started = Date.now();
      const candidates = await dsCvRole(up.cvText);
      row.elapsedMs = Date.now() - started;
      const top = candidates[0] || {};
      row.result = {
        canonical_title: top.canonical_title,
        confidence: top.confidence,
        raw_confidence: top.raw_confidence,
        agreement: top.agreement,
        skills_model_title: top.skills_model_title,
        skills_model_confidence: top.skills_model_confidence,
        candidates: candidates.map((c) => ({
          canonical_title: c.canonical_title,
          confidence: c.confidence,
          raw_confidence: c.raw_confidence,
        })),
      };
      // Replay the backend/frontend decision rules offline.
      row.decision = {
        llmFallbackFires: candidates.every((c) => (c.confidence || 0) < LLM_THRESHOLD),
        autoAccepted: (top.confidence || 0) >= AUTO_MATCH,
      };
    } catch (err) {
      const res = err.response;
      row.error = { status: res ? res.status : null, body: res ? res.data : err.message };
    }
    appendRawLine(outFile, row);
    const label = row.error
      ? `ERR ${row.error.status}`
      : `${String(row.result.canonical_title).padEnd(26)} @${String(row.result.confidence).padStart(6)} ${String(row.result.agreement || '-').padEnd(24)} ${row.decision.llmFallbackFires ? 'LLM' : row.decision.autoAccepted ? 'auto' : 'manual'}`;
    console.log(`  ${String(i + 1).padStart(2)}/${cvs.length} ${cv.file.slice(0, 42).padEnd(43)} ${label}`);
  }
  console.log('\nraw:', outPath);
}

main().catch((err) => {
  console.error('ablation failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
