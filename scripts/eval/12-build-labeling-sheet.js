/**
 * Step 10: build the BLIND annotation sheet for the scoring agent.
 *
 * Hard rule (M05 kickoff, risk R4): the sheet carries CV text, JD text and the
 * skill list - and NOT a single model score. If an agent score leaks into the
 * sheet the resulting metric is worthless, so this script reads only the skill
 * NAMES from the run and asserts that no score field reaches the output.
 *
 * Intra-rater control: 5 pairs are silently duplicated in a different position
 * and with their skills in a different order. Comparing a rater against their
 * own repeats gives the effective ceiling for any agreement number - without an
 * inter-annotator study, that ceiling is the honest yardstick.
 *
 * Output: a self-contained HTML sheet that saves answers to localStorage and
 * exports JSON, so labelling needs no server and no network.
 *
 * Usage: node scripts/eval/12-build-labeling-sheet.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR } = require('./common');

const DUPLICATES = 5;
// Deterministic shuffle: a fixed seed keeps the sheet reproducible across runs,
// and Math.random() is avoided so a rebuild does not reorder a partly-done sheet.
let seed = 20260802;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pairsFile = path.join(RAW_DIR, '10-cv-jd-pairs.json');
const scoresFile = path.join(RAW_DIR, '11-pair-scores.jsonl');

const { pairs } = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
const scored = fs
  .readFileSync(scoresFile, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
  .filter((r) => !r.error);

const skillsByPair = new Map(scored.map((r) => [r.pair_id, r.skills.map((s) => s.name)]));
const jdById = new Map(pairs.map((p) => [p.pair_id, p]));

// Items: every scored pair once, plus DUPLICATES repeats with reordered skills.
const base = scored.map((r) => ({
  item_id: null,
  pair_id: r.pair_id,
  isRepeat: false,
  skills: skillsByPair.get(r.pair_id),
}));
const repeatSource = shuffle(base).slice(0, DUPLICATES);
const repeats = repeatSource.map((b) => ({
  item_id: null,
  pair_id: b.pair_id,
  isRepeat: true,
  skills: shuffle(b.skills),
}));

const items = shuffle([...base, ...repeats]).map((it, i) => ({
  ...it,
  item_id: `I${String(i + 1).padStart(3, '0')}`,
}));

// Guard: nothing score-shaped may reach the sheet.
for (const it of items) {
  for (const s of it.skills) {
    if (typeof s !== 'string') throw new Error(`non-string skill in ${it.item_id}`);
  }
}

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cvTextCache = new Map();
function cvExcerpt(file) {
  if (!cvTextCache.has(file)) {
    const row = scored.find((r) => r.cv_file === file);
    cvTextCache.set(file, row ? row.cv_true_title : '');
  }
  return cvTextCache.get(file);
}

const itemHtml = (it, idx) => {
  const p = jdById.get(it.pair_id);
  return `
<section class="item" id="${it.item_id}" data-item="${it.item_id}">
  <header>
    <span class="counter">${idx + 1} / ${items.length}</span>
    <h2>${esc(it.item_id)}</h2>
  </header>
  <div class="cols">
    <div class="col">
      <h3>Candidate CV</h3>
      <p class="meta">file: <code>${esc(p.cv_file)}</code></p>
      <p class="hint">Open the PDF from <code>test-fixtures/authentic-cvs/pdfs/</code> to read it in full.</p>
    </div>
    <div class="col">
      <h3>Job description</h3>
      <p class="meta">${esc(p.jd_posting_title)} — ${esc(p.jd_company || 'n/a')}</p>
      <div class="jd">${esc(p.jd_description)}</div>
    </div>
  </div>
  <h3>Rate each skill: how well does this CV evidence it, for this job? (0-10)</h3>
  <table class="skills">
    <thead><tr><th>Skill</th><th>Score 0-10</th><th>or</th></tr></thead>
    <tbody>
      ${it.skills.map((s, si) => `
      <tr>
        <td class="skill">${esc(s)}</td>
        <td><input type="number" min="0" max="10" step="1"
                   data-item="${it.item_id}" data-skill="${esc(s)}" data-idx="${si}"></td>
        <td class="band">
          <label><input type="radio" name="b-${it.item_id}-${si}" value="absent" data-item="${it.item_id}" data-skill="${esc(s)}"> absent</label>
          <label><input type="radio" name="b-${it.item_id}-${si}" value="weak" data-item="${it.item_id}" data-skill="${esc(s)}"> weak</label>
          <label><input type="radio" name="b-${it.item_id}-${si}" value="strong" data-item="${it.item_id}" data-skill="${esc(s)}"> strong</label>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>`;
};

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>M05 — blind scoring annotation</title>
<style>
  :root { --line:#d8d8e4; --ink:#1b1b28; --muted:#5c5c74; --accent:#4b3fd4; }
  body { font: 15px/1.55 -apple-system, Segoe UI, Roboto, sans-serif; color: var(--ink);
         max-width: 1080px; margin: 0 auto; padding: 24px; background:#fbfbfe; }
  h1 { margin-bottom: 4px; }
  .intro { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px 20px; margin-bottom:24px; }
  .intro strong { color: var(--accent); }
  .item { background:#fff; border:1px solid var(--line); border-radius:10px; padding:18px 20px; margin-bottom:22px; }
  .item header { display:flex; align-items:baseline; gap:12px; border-bottom:1px solid var(--line); padding-bottom:8px; }
  .item h2 { font-size:16px; margin:0; }
  .counter { color:var(--muted); font-size:13px; }
  .cols { display:grid; grid-template-columns:1fr 2fr; gap:20px; margin:14px 0; }
  .col h3 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 6px; }
  .meta { margin:2px 0; font-size:13px; }
  .hint { font-size:12px; color:var(--muted); }
  .jd { max-height:220px; overflow-y:auto; font-size:13px; background:#f6f6fb;
        border:1px solid var(--line); border-radius:6px; padding:10px; white-space:pre-wrap; }
  table.skills { width:100%; border-collapse:collapse; margin-top:6px; }
  table.skills th { text-align:left; font-size:12px; color:var(--muted); border-bottom:1px solid var(--line); padding:6px 4px; }
  table.skills td { border-bottom:1px solid #eee; padding:6px 4px; }
  td.skill { font-weight:600; }
  td input[type=number] { width:70px; padding:4px; }
  .band label { font-size:12px; margin-right:10px; color:var(--muted); }
  #bar { position:sticky; top:0; background:#fbfbfe; padding:10px 0; border-bottom:1px solid var(--line);
         display:flex; gap:12px; align-items:center; z-index:5; }
  button { background:var(--accent); color:#fff; border:0; border-radius:6px; padding:8px 14px; font-size:14px; cursor:pointer; }
  #progress { color:var(--muted); font-size:13px; }
  @media (max-width:820px){ .cols{grid-template-columns:1fr;} }
</style></head><body>

<div id="bar">
  <button id="export">Export answers (JSON)</button>
  <span id="progress"></span>
</div>

<h1>Blind annotation — CareerLens scoring evaluation</h1>
<div class="intro">
  <p>For each item: read the candidate's CV (open the PDF named under <em>Candidate CV</em>)
     and the job description, then rate <strong>how well the CV evidences each skill for that job</strong>.</p>
  <p>Use the <strong>0-10 box</strong> when you can; otherwise pick absent / weak / strong.
     0 = no evidence at all, 10 = extensive, demonstrated depth.</p>
  <p><strong>This sheet deliberately shows no model output.</strong> Judge only what you see.
     Some items may feel familiar — that is intended; rate them independently, do not try to recall a previous answer.</p>
  <p>Answers save to your browser automatically. When done, press <em>Export answers</em> and
     save the file to <code>docs/final-sprint/outputs/metrics-raw/13-human-labels.json</code>.</p>
</div>

${items.map(itemHtml).join('\n')}

<script>
const KEY = 'm05-labels-v1';
const store = JSON.parse(localStorage.getItem(KEY) || '{}');
const total = ${items.reduce((n, it) => n + it.skills.length, 0)};

function save(item, skill, value, kind) {
  store[item] = store[item] || {};
  store[item][skill] = { ...(store[item][skill] || {}), [kind]: value };
  localStorage.setItem(KEY, JSON.stringify(store));
  progress();
}
function progress() {
  let done = 0;
  for (const it of Object.values(store)) {
    for (const s of Object.values(it)) if (s.score != null || s.band != null) done++;
  }
  document.getElementById('progress').textContent = done + ' / ' + total + ' ratings';
}
document.querySelectorAll('input[type=number]').forEach(el => {
  const prev = (store[el.dataset.item] || {})[el.dataset.skill];
  if (prev && prev.score != null) el.value = prev.score;
  el.addEventListener('input', () => save(el.dataset.item, el.dataset.skill, el.value === '' ? null : Number(el.value), 'score'));
});
document.querySelectorAll('input[type=radio]').forEach(el => {
  const prev = (store[el.dataset.item] || {})[el.dataset.skill];
  if (prev && prev.band === el.value) el.checked = true;
  el.addEventListener('change', () => save(el.dataset.item, el.dataset.skill, el.value, 'band'));
});
document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ labels: store, exportedAt: new Date().toISOString() }, null, 2)],
                        { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '13-human-labels.json';
  a.click();
});
progress();
</script>
</body></html>`;

const sheetPath = path.join(RAW_DIR, '12-labeling-sheet.html');
fs.writeFileSync(sheetPath, html, 'utf8');

// The key that maps blinded item ids back to pairs stays OUT of the sheet.
const keyPath = path.join(RAW_DIR, '12-labeling-key.json');
fs.writeFileSync(
  keyPath,
  JSON.stringify(
    { duplicates: DUPLICATES, items: items.map(({ item_id, pair_id, isRepeat, skills }) => ({ item_id, pair_id, isRepeat, skills })) },
    null,
    2
  ),
  'utf8'
);

console.log(`items: ${items.length} (${scored.length} pairs + ${DUPLICATES} blind repeats)`);
console.log(`ratings requested: ${items.reduce((n, it) => n + it.skills.length, 0)}`);
console.log(`sheet: ${sheetPath}`);
console.log(`key  : ${keyPath}  (not referenced by the sheet)`);
