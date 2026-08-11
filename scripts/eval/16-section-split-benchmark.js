/**
 * 16 - Section-split benchmark for the /improve flow.
 *
 * Runs the REAL splitter (backend/src/services/cvImprove.service.ts) over the
 * authentic-CV corpus and scores how well each layout divides into sections.
 *
 * The metric that matters for the product is LOCALIZATION: when a weak skill is
 * mentioned in the CV, how small is the section we hand to the rephrase agent?
 * Before the heading-aware split, every CV collapsed into one section, so that
 * figure was always 100% - the agent was asked to rewrite the whole document.
 *
 *   node scripts/eval/16-section-split-benchmark.js [--demo] [--json out.json]
 *
 * --demo runs the purpose-built set in test-fixtures/improve-demo instead of the
 * authentic corpus: three CVs whose only job is to exercise every branch of the
 * improve flow (multi-mention, single-mention, absent skill, shared section)
 * across three different heading styles.
 */
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const CORPUS = path.join(REPO, 'test-fixtures', 'authentic-cvs');
const breq = createRequire(path.join(REPO, 'backend', 'package.json'));

breq('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true },
});
const { PDFParse } = breq('pdf-parse');
const { splitCvIntoSections, extractContext, composeCvFromSections } =
  require(path.join(REPO, 'backend', 'src', 'services', 'cvImprove.service.ts'));

// Skills probed per CV. Deliberately generic and cross-role: the point is to
// measure how tightly a mentioned skill localizes, not to score any one CV.
const PROBE_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'C++', 'SQL',
  'Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Git', 'Linux',
  'Machine Learning', 'TensorFlow', 'PyTorch', 'pandas', 'Spark', 'Airflow',
  'Selenium', 'Cypress', 'REST APIs', 'MongoDB', 'PostgreSQL', 'Redis',
  'VHDL', 'Verilog', 'FPGA', 'Embedded C', 'RTOS',
  'Penetration Testing', 'Reverse Engineering', 'SIEM', 'Malware Analysis',
].map((skill) => ({ skill, score: 3 }));

const pct = (n) => `${(n * 100).toFixed(0)}%`;

async function extractPdfText(file) {
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  try {
    return (await parser.getText()).text.trim();
  } finally {
    await parser.destroy();
  }
}

function scoreSplit(raw) {
  const sections = splitCvIntoSections(raw);
  const total = sections.reduce((n, s) => n + s.originalText.length, 0) || 1;

  const largestShare = Math.max(...sections.map((s) => s.originalText.length)) / total;
  const labelled = sections.filter((s) => !/^Section \d+$/.test(s.label)).length;
  const kinds = new Set(sections.map((s) => s.kind));

  // Localization: for every probed skill that IS mentioned, how much of the CV
  // does its primary section cover? Median across skills.
  const { skills } = extractContext(raw, PROBE_SKILLS);
  const byId = Object.fromEntries(sections.map((s) => [s.sectionId, s]));
  const shares = skills
    .filter((c) => c.found && byId[c.primaryOccurrence.sectionId])
    .map((c) => byId[c.primaryOccurrence.sectionId].originalText.length / total)
    .sort((a, b) => a - b);
  const median = shares.length
    ? shares[Math.floor((shares.length - 1) / 2)]
    : null;

  // Fidelity: re-composing must not drop any content line (page markers aside).
  const recomposed = composeCvFromSections({ sections });
  const lost = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^[\s–—-]*(?:page\s*)?\d+\s*(?:of|\/)\s*\d+[\s–—-]*$/i.test(l))
    .filter((l) => !recomposed.includes(l));

  const pageMarkerLeaked = sections.some((s) =>
    s.originalText.split('\n').some((l) => /^[\s–—-]*(?:page\s*)?\d+\s*(?:of|\/)\s*\d+[\s–—-]*$/i.test(l.trim()))
  );

  return {
    sectionCount: sections.length,
    labelledCount: labelled,
    labelledShare: sections.length ? labelled / sections.length : 0,
    largestShare,
    kinds: [...kinds],
    hasSkills: kinds.has('skills'),
    hasExperience: kinds.has('experience'),
    hasEducation: kinds.has('education'),
    skillsProbed: shares.length,
    medianSkillShare: median,
    lostLines: lost.length,
    pageMarkerLeaked,
    labels: sections.map((s) => `${s.label} [${s.kind}]`),
  };
}

// A split is "good" when the CV is genuinely divided, the divisions are named,
// and a mentioned skill lands in a small part of the document.
function verdict(m) {
  if (m.lostLines > 0 || m.pageMarkerLeaked) return 'BROKEN';
  if (m.sectionCount <= 1 || m.largestShare > 0.8) return 'POOR';
  if (m.medianSkillShare !== null && m.medianSkillShare > 0.5) return 'POOR';
  if (m.labelledShare >= 0.7 && (m.medianSkillShare === null || m.medianSkillShare <= 0.3)) return 'GOOD';
  return 'FAIR';
}

const DEMO = path.join(REPO, 'test-fixtures', 'improve-demo');

function loadEntries() {
  if (process.argv.includes('--demo')) {
    const dir = path.join(DEMO, 'pdfs');
    return {
      dir,
      entries: fs.readdirSync(dir)
        .filter((f) => f.endsWith('.pdf'))
        .map((file) => ({ file, template: 'demo', seniority: 'n/a' })),
    };
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(CORPUS, 'manifest.json'), 'utf8'));
  return {
    dir: path.join(CORPUS, 'pdfs'),
    entries: manifest.cvs.filter((c) => !c.is_negative_fixture),
  };
}

(async () => {
  const { dir, entries } = loadEntries();

  const rows = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.file);
    if (!fs.existsSync(file)) { console.log(`MISSING ${entry.file}`); continue; }
    let raw;
    try {
      raw = await extractPdfText(file);
    } catch (err) {
      console.log(`UNPARSEABLE ${entry.file}: ${err.message}`);
      continue;
    }
    const m = scoreSplit(raw);
    rows.push({ file: entry.file, template: entry.template, seniority: entry.seniority, ...m, verdict: verdict(m) });
  }

  console.log(`\n=== Section split over ${rows.length} authentic CVs ===\n`);
  console.log('tmpl  sec  labelled  largest  medSkill  verdict  file');
  console.log('-'.repeat(96));
  for (const r of [...rows].sort((a, b) => a.template.localeCompare(b.template))) {
    console.log(
      `${r.template.padEnd(5)} ${String(r.sectionCount).padStart(3)}  ` +
      `${pct(r.labelledShare).padStart(7)}  ${pct(r.largestShare).padStart(6)}  ` +
      `${(r.medianSkillShare === null ? '  n/a' : pct(r.medianSkillShare)).padStart(7)}  ` +
      `${r.verdict.padEnd(7)}  ${r.file}`
    );
  }

  // ── Per-template rollup: this is the "when is the split best" answer ──
  const byTemplate = new Map();
  for (const r of rows) {
    if (!byTemplate.has(r.template)) byTemplate.set(r.template, []);
    byTemplate.get(r.template).push(r);
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

  console.log(`\n=== By template ===\n`);
  console.log('tmpl  n   avg sec  avg labelled  avg largest  avg medSkill  good/fair/poor');
  console.log('-'.repeat(84));
  for (const [tmpl, rs] of [...byTemplate].sort()) {
    const withSkill = rs.filter((r) => r.medianSkillShare !== null);
    const counts = ['GOOD', 'FAIR', 'POOR', 'BROKEN'].map((v) => rs.filter((r) => r.verdict === v).length);
    console.log(
      `${tmpl.padEnd(5)} ${String(rs.length).padStart(2)}  ` +
      `${mean(rs.map((r) => r.sectionCount)).toFixed(1).padStart(7)}  ` +
      `${pct(mean(rs.map((r) => r.labelledShare))).padStart(12)}  ` +
      `${pct(mean(rs.map((r) => r.largestShare))).padStart(11)}  ` +
      `${(withSkill.length ? pct(mean(withSkill.map((r) => r.medianSkillShare))) : 'n/a').padStart(12)}  ` +
      `${counts[0]}/${counts[1]}/${counts[2]}${counts[3] ? ` (+${counts[3]} broken)` : ''}`
    );
  }

  console.log(`\n=== Totals ===`);
  for (const v of ['GOOD', 'FAIR', 'POOR', 'BROKEN']) {
    const n = rows.filter((r) => r.verdict === v).length;
    if (n) console.log(`  ${v.padEnd(7)} ${n}/${rows.length}`);
  }
  console.log(`  content lines lost anywhere : ${rows.reduce((n, r) => n + r.lostLines, 0)}`);
  console.log(`  page markers leaked         : ${rows.filter((r) => r.pageMarkerLeaked).length}`);
  console.log(`  CVs with a Skills section   : ${rows.filter((r) => r.hasSkills).length}/${rows.length}`);
  console.log(`  CVs with an Experience sect.: ${rows.filter((r) => r.hasExperience).length}/${rows.length}`);
  console.log(`  CVs with an Education sect. : ${rows.filter((r) => r.hasEducation).length}/${rows.length}`);

  const worst = rows.filter((r) => r.verdict === 'POOR' || r.verdict === 'BROKEN');
  if (worst.length) {
    console.log(`\n=== Where it splits worst ===`);
    for (const r of worst) {
      console.log(`\n  ${r.file} (${r.template}) - ${r.verdict}`);
      console.log(`    sections: ${r.labels.join(' | ')}`);
    }
  }

  const jsonIdx = process.argv.indexOf('--json');
  if (jsonIdx > -1 && process.argv[jsonIdx + 1]) {
    fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(rows, null, 2));
    console.log(`\nwrote ${process.argv[jsonIdx + 1]}`);
  }
})();
