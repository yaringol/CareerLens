/**
 * CareerLens POC Test Runner
 *
 * For each of the 15 CVs (5 roles × weak/mid/strong) this script:
 *   1. Uploads the PDF to POST /api/upload
 *   2. Runs POST /api/analyze (up to RUNS times, averaged for stability)
 *   3. Checks the matchScore against the expected range for that level
 *   4. If it fails, retries up to MAX_ITERATIONS (score can fluctuate due to LLM non-determinism)
 *   5. Reports a full results table and exits non-zero on any failure
 *
 * Usage:
 *   node test_poc.js                   # 1 run per CV, default API URL
 *   RUNS=3 node test_poc.js            # 3 runs per CV (average) for stability
 *   API_URL=http://localhost:9000 node test_poc.js
 */

'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { JOB_DESCRIPTIONS } = require('./job_descriptions');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL    = process.env.TEST_EMAIL    || 'may@careerlens.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '1234';
const RUNS_PER_TEST = Math.max(1, parseInt(process.env.RUNS || '1', 10));
const CVS_DIR = path.join(__dirname, 'cvs');
const MAX_ITERATIONS = 3;   // retries per CV if score is outside expected range

let authToken = '';

// Score ranges per level
const EXPECTED = {
  weak:   { min: 1.0, max: 4.0,  label: '[1.0 – 4.0]' },
  mid:    { min: 4.0, max: 6.5,  label: '[4.0 – 6.5]' },
  strong: { min: 8.0, max: 10.0, label: '[8.0 – 10.0]' },
};

const JOB_TITLES = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'DevOps Engineer',
  'Frontend Developer',
];
const LEVELS = ['weak', 'mid', 'strong'];

// ── Colours / emoji for terminal output ──────────────────────────────────────
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`;

// ── API helpers ───────────────────────────────────────────────────────────────

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function login() {
  const res = await axios.post(
    `${BASE_URL}/api/auth/login`,
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { timeout: 10000 },
  );
  authToken = res.data.token;
}

async function getJobs() {
  const res = await axios.get(`${BASE_URL}/api/jobs`, {
    headers: authHeaders(),
    timeout: 10000,
  });
  return res.data.reduce((m, job) => {
    m[job.title] = job.id || job._id;
    return m;
  }, {});
}

async function uploadCV(pdfPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: path.basename(pdfPath) });
  const res = await axios.post(`${BASE_URL}/api/upload?save=false`, form, {
    headers: { ...form.getHeaders(), ...authHeaders() },
    timeout: 30000,
  });
  return res.data.cvText;
}

async function analyzeCV(jobId, cvText, jobDescription) {
  const res = await axios.post(
    `${BASE_URL}/api/analyze`,
    { jobId, cvText, jobDescription },
    { headers: authHeaders(), timeout: 90000 },
  );
  return res.data; // { jobTitle, skills:[{name,score}], matchScore, id }
}

// ── Single CV test (multiple runs averaged) ───────────────────────────────────

async function runOnce(jobTitle, level, jobId, jobDescription) {
  const fileName = `${jobTitle.replace(/ /g, '_')}_${level}.pdf`;
  const pdfPath  = path.join(CVS_DIR, fileName);

  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${fileName}`);

  const cvText = await uploadCV(pdfPath);
  const scores = [];
  const allSkills = [];

  for (let r = 1; r <= RUNS_PER_TEST; r++) {
    const result = await analyzeCV(jobId, cvText, jobDescription);
    scores.push(result.matchScore);
    allSkills.push(result.skills || []);
    if (RUNS_PER_TEST > 1) {
      process.stdout.write(DIM(`      run ${r}: ${result.matchScore.toFixed(2)}\n`));
    }
    if (r < RUNS_PER_TEST) await sleep(500); // brief pause between runs
  }

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { avgScore, scores, skills: allSkills[0] || [] };
}

// ── Iterating wrapper ─────────────────────────────────────────────────────────

async function testWithIteration(jobTitle, level, jobId, jobDescription) {
  const range = EXPECTED[level];
  let last = null;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    if (iter > 1) {
      process.stdout.write(
        YELLOW(`    ↻ retry ${iter}/${MAX_ITERATIONS} — previous avg ${last.avgScore.toFixed(2)}, expected ${range.label}\n`),
      );
      await sleep(1500);
    }

    last = await runOnce(jobTitle, level, jobId, jobDescription);
    const inRange = last.avgScore >= range.min && last.avgScore <= range.max;

    if (inRange) return { ...last, passed: true, iterations: iter };
  }

  return { ...last, passed: false, iterations: MAX_ITERATIONS };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pad(str, n) {
  return String(str).padEnd(n);
}

function fmtScore(n) {
  return n.toFixed(2);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(BOLD('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(BOLD('║          CareerLens POC Test Suite                         ║'));
  console.log(BOLD('╚════════════════════════════════════════════════════════════╝'));
  console.log(`  Backend  : ${BASE_URL}`);
  console.log(`  CVs dir  : ${CVS_DIR}`);
  console.log(`  Runs/test: ${RUNS_PER_TEST}  (set RUNS=3 for more stability)\n`);

  // ── Login ──────────────────────────────────────────────────────────────────
  try {
    await login();
    console.log(GREEN(`  ✓ Logged in as ${TEST_EMAIL}\n`));
  } catch (e) {
    console.error(RED(`  ✗ Login failed at ${BASE_URL}/api/auth/login — ${e.message}`));
    console.error('    Check TEST_EMAIL / TEST_PASSWORD env vars or that the backend is running.\n');
    process.exit(1);
  }

  // ── Check backend ──────────────────────────────────────────────────────────
  try {
    await axios.get(`${BASE_URL}/api/jobs`, { headers: authHeaders(), timeout: 5000 });
    console.log(GREEN('  ✓ Backend reachable\n'));
  } catch {
    console.error(RED(`  ✗ Cannot reach backend at ${BASE_URL}`));
    console.error('    Start it with:  cd backend && npm run dev\n');
    process.exit(1);
  }

  // ── Load jobs ──────────────────────────────────────────────────────────────
  let jobs;
  try {
    jobs = await getJobs();
    console.log(GREEN(`  ✓ Loaded ${Object.keys(jobs).length} jobs from DB\n`));
  } catch (e) {
    console.error(RED('  ✗ Failed to load jobs: ' + e.message));
    process.exit(1);
  }

  const results = [];
  let totalPass = 0;
  let totalFail = 0;

  for (const jobTitle of JOB_TITLES) {
    const jobId = jobs[jobTitle];
    if (!jobId) {
      console.warn(YELLOW(`  ⚠  "${jobTitle}" not in DB — run: cd backend && npm run seed`));
      continue;
    }

    console.log(BOLD(`\n── ${jobTitle} ──`));
    const jdEntry = JOB_DESCRIPTIONS[jobTitle];
    // Support both the old flat format { role: string } and the new
    // per-level format { role: { weak, mid, strong } }.
    const getJD = (lvl) =>
      typeof jdEntry === 'string' ? jdEntry : (jdEntry[lvl] ?? jdEntry.mid ?? '');

    for (const level of LEVELS) {
      const range = EXPECTED[level];
      process.stdout.write(`  ${pad(level, 8)}`);

      let result;
      try {
        result = await testWithIteration(jobTitle, level, jobId, getJD(level));
      } catch (e) {
        console.log(RED(` ERROR`) + ` — ${e.message}`);
        results.push({ jobTitle, level, error: e.message });
        totalFail++;
        continue;
      }

      const { avgScore, passed, iterations, skills } = result;
      const iterNote = iterations > 1 ? DIM(` (${iterations} iter)`) : '';
      const status   = passed ? GREEN('✓ PASS') : RED('✗ FAIL');
      const scoreStr = passed ? GREEN(fmtScore(avgScore)) : RED(fmtScore(avgScore));

      console.log(` ${status}  score=${scoreStr}  expected=${range.label}${iterNote}`);

      // On failure show per-skill breakdown to guide CV improvement
      if (!passed && skills.length) {
        console.log(DIM(`    Skills breakdown:`));
        for (const s of skills) {
          const bar = '█'.repeat(Math.round(s.score));
          console.log(DIM(`      ${pad(s.name, 35)} ${pad(s.score, 4)} ${bar}`));
        }
        console.log('');
      }

      results.push({ jobTitle, level, avgScore, passed, iterations });
      if (passed) totalPass++;
      else totalFail++;
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log(BOLD('\n\n╔═══════════════════════════════════════════════════════════════════════╗'));
  console.log(BOLD('║                       RESULTS SUMMARY                               ║'));
  console.log(BOLD('╠═══════════════════════════════════════════════════════════════════════╣'));
  console.log(BOLD('║ Job Title                 Level    Score    Expected       Status    ║'));
  console.log(BOLD('╠═══════════════════════════════════════════════════════════════════════╣'));

  for (const r of results) {
    if (r.error) {
      console.log(`║ ${pad(r.jobTitle, 26)}${pad(r.level, 9)}ERROR${' '.repeat(30)} ║`);
    } else {
      const range  = EXPECTED[r.level];
      const status = r.passed ? 'PASS' : 'FAIL';
      const score  = fmtScore(r.avgScore);
      const line   = `║ ${pad(r.jobTitle, 26)}${pad(r.level, 9)}${pad(score, 9)}${pad(range.label, 15)}${pad(status, 10)}║`;
      console.log(r.passed ? GREEN(line) : RED(line));
    }
  }

  console.log(BOLD('╚═══════════════════════════════════════════════════════════════════════╝'));
  console.log(`\n  Result: ${GREEN(totalPass + ' PASSED')} | ${totalFail > 0 ? RED(totalFail + ' FAILED') : DIM('0 FAILED')} | ${results.length} total\n`);

  if (totalFail > 0) {
    console.log(YELLOW('  Some CVs scored outside their expected range.'));
    console.log('  Review the skill breakdowns printed above, then edit cv_content.js:');
    console.log('    • Weak scores too HIGH   → remove any skill mentions, use more unrelated content');
    console.log('    • Mid  scores too LOW    → add more explicit skill demonstrations');
    console.log('    • Strong scores too LOW  → add more metrics, achievements, and keyword density');
    console.log('  Then re-run: npm run run-poc\n');
    process.exit(1);
  }

  console.log(GREEN('  ✓ All tests passed! The CV levels correctly represent weak / mid / strong profiles.\n'));
}

main().catch((err) => {
  console.error(RED('\nUnhandled error: ' + err.message));
  console.error(err.stack);
  process.exit(1);
});
