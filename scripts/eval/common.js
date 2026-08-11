/**
 * Shared client for the M05 evaluation harness.
 *
 * Every call goes through the real HTTP surface (auth, middleware, upload
 * limits, thresholds) rather than importing services in-process, because those
 * layers are part of the behaviour being measured. See
 * docs/final-sprint/outputs/kickoffs/05-kickoff.md section 3.2.
 *
 * Dependencies are resolved from backend/node_modules - this repo has no
 * package.json under scripts/, and the backend already ships axios+form-data.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(
  path.join(__dirname, '..', '..', 'backend', 'package.json')
);
const axios = backendRequire('axios');
const FormData = backendRequire('form-data');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DS_URL = process.env.DS_MODEL_URL || 'http://localhost:8000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'm05-eval@careerlens.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'm05-eval-pass';

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'test-fixtures', 'authentic-cvs');
const RAW_DIR = path.join(REPO_ROOT, 'docs', 'final-sprint', 'outputs', 'metrics-raw');

/**
 * Registers the eval user on first run, then logs in. Returns a bearer token.
 * /login answers 404 (not 401) for an unknown email, and /register hands back a
 * token directly - see backend/src/routes/auth.routes.ts:37,53.
 */
async function login() {
  try {
    const res = await axios.post(`${API_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    return res.data.token;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const reg = await axios.post(`${API_URL}/api/auth/register`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      return reg.data.token;
    }
    throw err;
  }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Real multipart upload. save=false keeps the 10-CV library cap (and its
 * favourite-deleting bug) out of the measurement.
 * Returns { cvId, cvText, headerText, rawText, fileName }.
 */
async function uploadPdf(token, pdfPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath));
  const res = await axios.post(`${API_URL}/api/upload?save=false`, form, {
    headers: { ...auth(token), ...form.getHeaders() },
    maxBodyLength: Infinity,
    timeout: 120000,
  });
  return res.data;
}

/**
 * The richer ladder-level result: exposes `source` ('title_extraction' |
 * 'cv_classifier'), low_confidence, candidates and the M19 agreement fields.
 * This is the endpoint calibration needs - /api/cv/title collapses `source`
 * into the suggestion-level enum.
 */
async function extractTitle(token, cvText, headerText) {
  const res = await axios.post(
    `${API_URL}/api/cv/extract-title`,
    { cvText, headerText },
    { headers: auth(token), timeout: 120000 }
  );
  return res.data;
}

/** What the frontend actually receives: { detectedTitle, confidence, source, suggestions }. */
async function detectTitle(token, cvText, headerText) {
  const res = await axios.post(
    `${API_URL}/api/cv/title`,
    { cvText, headerText },
    { headers: auth(token), timeout: 120000 }
  );
  return res.data;
}

/** Direct DS call - used for the pure-sklearn determinism probe (no LLM in path). */
async function dsCvRole(text) {
  const res = await axios.get(`${DS_URL}/cv/role`, {
    params: { text },
    timeout: 120000,
  });
  return res.data;
}

async function analyze(token, { canonicalTitle, cvText, jobDescription, cvOnly }) {
  const headers = auth(token);
  if (cvOnly) headers['X-Skip-Gibberish'] = 'true';
  const body = { canonicalTitle, cvText };
  if (jobDescription) body.jobDescription = jobDescription;
  const res = await axios.post(`${API_URL}/api/analyze`, body, {
    headers,
    timeout: 180000,
  });
  return res.data;
}

function loadManifest() {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

const pdfPath = (file) => path.join(FIXTURES_DIR, 'pdfs', file);

function writeRaw(name, data) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const out = path.join(RAW_DIR, name);
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
  return out;
}

/** Appends one JSON object per line, so a crash mid-run keeps prior rows (risk R8). */
function appendRawLine(name, row) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const out = path.join(RAW_DIR, name);
  fs.appendFileSync(out, JSON.stringify(row) + '\n', 'utf8');
  return out;
}

module.exports = {
  API_URL,
  DS_URL,
  FIXTURES_DIR,
  RAW_DIR,
  login,
  uploadPdf,
  extractTitle,
  detectTitle,
  dsCvRole,
  analyze,
  loadManifest,
  pdfPath,
  writeRaw,
  appendRawLine,
};
