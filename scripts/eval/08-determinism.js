/**
 * Step 7: determinism probe.
 *
 * Two layers, because they have different failure modes:
 *   DS /cv/role   - pure sklearn predict_proba. Should be bit-stable; if it is
 *                   not, BLAS threading is the suspect and OMP_NUM_THREADS=1
 *                   is the fix (the repo pins no thread count anywhere).
 *   /api/cv/title - the full product ladder, whose first rung is an LLM at
 *                   temperature 0.2 with no seed. Instability here is expected
 *                   and is a Limitations-section fact, not a bug to fix.
 *
 * Usage: node scripts/eval/08-determinism.js [--runs 5]
 */
const { login, uploadPdf, detectTitle, dsCvRole, pdfPath, writeRaw } = require('./common');

const runsArg = process.argv.indexOf('--runs');
const RUNS = runsArg > -1 ? Number(process.argv[runsArg + 1]) : 5;

// One header-dominated CV (exercises the LLM rung) and one that lands on the
// classifier, so both layers are covered.
const FILES = ['software-mid-mid_Tomer-Azulay.pdf', 'gamedev-mid-none_Ben-Harari.pdf'];

const uniq = (a) => [...new Set(a)];

async function main() {
  const token = await login();
  const report = { runs: RUNS, files: {} };

  for (const file of FILES) {
    const up = await uploadPdf(token, pdfPath(file));
    const ds = [];
    const product = [];

    for (let i = 0; i < RUNS; i += 1) {
      const roles = await dsCvRole(up.cvText);
      const top = roles[0] || {};
      ds.push(`${top.canonical_title}@${top.confidence}`);

      const det = await detectTitle(token, up.cvText, up.headerText);
      product.push(`${det.detectedTitle}@${det.confidence}`);
    }

    report.files[file] = {
      dsCvRole: { values: ds, distinct: uniq(ds).length, stable: uniq(ds).length === 1 },
      productLadder: {
        values: product,
        distinct: uniq(product).length,
        stable: uniq(product).length === 1,
      },
    };

    console.log(`\n${file}`);
    console.log(`  DS /cv/role     : ${uniq(ds).length === 1 ? 'STABLE' : 'UNSTABLE'} - ${uniq(ds).join(' | ')}`);
    console.log(`  /api/cv/title   : ${uniq(product).length === 1 ? 'STABLE' : 'UNSTABLE'} - ${uniq(product).join(' | ')}`);
  }

  const dsStable = Object.values(report.files).every((f) => f.dsCvRole.stable);
  report.verdict = {
    dsLayerStable: dsStable,
    ompPinNeeded: !dsStable,
    note: dsStable
      ? 'sklearn layer reproducible across runs; no thread pin required'
      : 'sklearn layer varies across runs - pin OMP_NUM_THREADS=1 and re-measure',
  };
  console.log(`\nverdict: ${report.verdict.note}`);
  console.log('written:', writeRaw('08-determinism.json', report));
}

main().catch((err) => {
  console.error('determinism probe failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
