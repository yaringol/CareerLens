/**
 * Records the exact serving configuration every measurement was taken under.
 *
 * Risk R1 in the M05 kickoff: the DS server's ranking config is env-driven, and
 * docker-compose.yaml sets none of it - so a number measured here is only
 * quotable alongside the config that produced it. The DS server exposes no
 * status endpoint, so the config is identified *behaviourally*: /title/skills
 * output is compared against what each candidate config produces offline.
 *
 * Usage: node scripts/eval/00-env-snapshot.js
 */
const { DS_URL, API_URL, writeRaw } = require('./common');
const path = require('path');
const { createRequire } = require('module');
const backendRequire = createRequire(
  path.join(__dirname, '..', '..', 'backend', 'package.json')
);
const axios = backendRequire('axios');

// Titles where legacy (cap=48/min_prev=0.0) and measured (11/0.05) configs
// produce different top-5 lists, computed offline from model.joblib.
const DISCRIMINATORS = {
  'Software Engineer': {
    legacy: ['python', 'docker', 'api', 'nice', 'software development'],
    measured: ['llm', 'python', 'docker', 'api', 'software development'],
  },
  'Cyber Security': {
    legacy: ['cloud security', 'english', 'management', 'python', 'penetration testing'],
    measured: ['cloud security', 'cybersecurity', 'python', 'penetration testing', 'computer science'],
  },
  'Data Scientist': {
    legacy: ['llm', 'generative ai', 'pytorch', 'data science', 'english'],
    measured: ['llm', 'generative ai', 'pytorch', 'data science', 'deep learning'],
  },
  'Backend Developer': {
    legacy: ['kubernetes', 'javascript', 'docker', 'node js', 'git'],
    measured: ['kubernetes', 'javascript', 'software development', 'docker', 'node js'],
  },
};

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const snapshot = {
    takenAt: new Date().toISOString(),
    apiUrl: API_URL,
    dsUrl: DS_URL,
    rankingConfig: { verdict: null, perTitle: {} },
    agreementSignal: { enabled: null, probe: null },
    modelArtifact: {},
  };

  // 1. Ranking config (SKILL_UBIQUITY_CAP / ROLE_COUNT_MIN_PREVALENCE)
  let measuredHits = 0;
  let legacyHits = 0;
  for (const [title, expected] of Object.entries(DISCRIMINATORS)) {
    const res = await axios.get(`${DS_URL}/title/skills`, {
      params: { title, top_n: 5 },
      timeout: 60000,
    });
    const live = res.data.skills.map((s) => s.skill);
    const verdict = same(live, expected.measured)
      ? 'measured'
      : same(live, expected.legacy)
        ? 'legacy'
        : 'neither';
    if (verdict === 'measured') measuredHits += 1;
    if (verdict === 'legacy') legacyHits += 1;
    snapshot.rankingConfig.perTitle[title] = { live, verdict };
    snapshot.modelArtifact.trainedAt = res.data.trained_at;
  }
  snapshot.rankingConfig.verdict =
    measuredHits === Object.keys(DISCRIMINATORS).length
      ? 'SKILL_UBIQUITY_CAP=11, ROLE_COUNT_MIN_PREVALENCE=0.05 (the measured/M06 config)'
      : legacyHits > 0
        ? 'legacy defaults (cap=48, min_prevalence=0.0) - NUMBERS NOT COMPARABLE TO THE REPORT'
        : 'unrecognised config - investigate before measuring';

  // 2. Agreement signal (AGREEMENT_SIGNAL_ENABLED): the fields only appear when on.
  const probeText =
    'Experienced backend engineer building REST APIs with Python, Django, ' +
    'PostgreSQL, Docker and Kubernetes. Designed microservices and CI/CD pipelines.';
  const roleRes = await axios.get(`${DS_URL}/cv/role`, {
    params: { text: probeText },
    timeout: 120000,
  });
  const top = roleRes.data[0] || {};
  snapshot.agreementSignal.enabled = Object.prototype.hasOwnProperty.call(top, 'agreement');
  snapshot.agreementSignal.probe = top;

  const out = writeRaw('00-env-snapshot.json', snapshot);

  console.log('Ranking config :', snapshot.rankingConfig.verdict);
  console.log('Model trained_at:', snapshot.modelArtifact.trainedAt);
  console.log('Agreement signal:', snapshot.agreementSignal.enabled ? 'ON' : 'OFF');
  console.log('Written        :', out);
}

main().catch((err) => {
  console.error('env snapshot failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
