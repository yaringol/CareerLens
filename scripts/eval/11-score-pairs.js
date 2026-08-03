/**
 * Steps 11-13: run every CV x JD pair through the real scoring agent, measure
 * run-to-run stability, and collect the keyword baseline.
 *
 * Three passes per pair:
 *   1. /api/analyze          - the product path; yields the 10 skills, their
 *                              LLM scores, evidence/missing, and matchScore.
 *   2. /api/analyze/rescore  - the SAME skill list re-scored, repeated, so
 *                              scoring variance is isolated from skill-selection
 *                              variance (dynamic skill extraction is itself an
 *                              LLM agent and would otherwise be confounded).
 *   3. keyword baseline      - computed here from the CV text with the same
 *                              token-overlap rule the backend falls back to
 *                              (scoring.service.ts:19-32), since no HTTP route
 *                              exposes keyword-only scoring.
 *
 * Usage: node scripts/eval/11-score-pairs.js [--retests 3] [--limit N]
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const {
  login, uploadPdf, analyze, pdfPath, appendRawLine, RAW_DIR, API_URL,
} = require('./common');

const backendRequire = createRequire(
  path.join(__dirname, '..', '..', 'backend', 'package.json')
);
const axios = backendRequire('axios');

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { retests: 3, limit: null };
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === '--retests') out.retests = Number(a[i + 1]);
    if (a[i] === '--limit') out.limit = Number(a[i + 1]);
  }
  return out;
}

/** Mirror of overlapScoreForSkill (backend/src/services/scoring.service.ts:19-32). */
function overlapScoreForSkill(cvText, skill) {
  const cv = (cvText || '').toLowerCase();
  const tokens = (skill || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  const hits = tokens.filter((t) => cv.includes(t)).length;
  return Math.min(10, Math.max(0, Math.round((hits / tokens.length) * 10)));
}

/**
 * Body contract per analyze.routes.ts:304 - { jobTitle, cvText, skills } with
 * exactly 5 or 10 names. Re-scores a fixed skill list with no SkillNer and no
 * dynamic extraction, which is precisely what isolates scoring variance.
 */
async function rescore(token, jobTitle, cvText, skills) {
  const res = await axios.post(
    `${API_URL}/api/analyze/rescore`,
    { jobTitle, cvText, skills },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 180000 }
  );
  return res.data;
}

async function main() {
  const { retests, limit } = parseArgs();
  const outFile = '11-pair-scores.jsonl';
  const outPath = path.join(RAW_DIR, outFile);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const { pairs } = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, '10-cv-jd-pairs.json'), 'utf8')
  );
  const work = limit ? pairs.slice(0, limit) : pairs;

  console.log(`scoring ${work.length} CV x JD pairs (${retests} retests each)`);
  const token = await login();

  const cvCache = new Map();
  for (const [i, pair] of work.entries()) {
    const row = { ...pair, jd_description: undefined, jdLength: pair.jd_description.length };
    try {
      if (!cvCache.has(pair.cv_file)) {
        cvCache.set(pair.cv_file, await uploadPdf(token, pdfPath(pair.cv_file)));
      }
      const up = cvCache.get(pair.cv_file);

      const result = await analyze(token, {
        canonicalTitle: pair.cv_true_title,
        cvText: up.cvText,
        jobDescription: pair.jd_description,
      });

      row.analysisId = result.id;
      row.matchScore = result.matchScore;
      row.isEstimated = result.isEstimated;
      row.skills = result.skills.map((s) => ({
        name: s.name,
        score: s.score,
        evidence: s.evidence || null,
        missing: s.missing || null,
        keywordBaseline: overlapScoreForSkill(up.cvText, s.name),
      }));

      // Test-retest on a fixed skill list.
      const names = result.skills.map((s) => s.name);
      row.retest = [];
      for (let r = 0; r < retests; r += 1) {
        const again = await rescore(token, pair.cv_true_title, up.cvText, names);
        row.retest.push({
          matchScore: again.matchScore,
          scores: (again.skills || []).map((s) => s.score),
        });
      }
    } catch (err) {
      const res = err.response;
      row.error = { status: res ? res.status : null, body: res ? res.data : err.message };
    }
    appendRawLine(outFile, row);
    console.log(
      `  ${String(i + 1).padStart(2)}/${work.length} ${pair.band.padEnd(10)} ` +
      `${pair.cv_true_title.slice(0, 22).padEnd(23)} x ${String(pair.jd_og_title).slice(0, 22).padEnd(23)} ` +
      (row.error ? `ERR ${row.error.status}` : `match ${row.matchScore}/10`)
    );
  }
  console.log('\nraw:', outPath);
}

main().catch((err) => {
  console.error('scoring failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
