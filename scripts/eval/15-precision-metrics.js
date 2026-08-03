/**
 * Step 16: compute precision@10 for model 1 from the blind relevance labels.
 *
 * precision@10 for a model, on a role = (its top-10 skills marked relevant) / 10.
 * The rater marked a merged, shuffled union of the live and backup top-10 lists
 * without knowing which model proposed what, so the same judgement scores both.
 *
 * Reported per role and averaged, for the live artefact and the pre-M06 backup,
 * giving a measured before/after for the M06 ranking change.
 *
 * Usage: node scripts/eval/15-precision-metrics.js
 */
const fs = require('fs');
const path = require('path');
const { RAW_DIR, writeRaw } = require('./common');

const key = JSON.parse(fs.readFileSync(path.join(RAW_DIR, '14-precision-key.json'), 'utf8'));
const labelDoc = JSON.parse(fs.readFileSync(path.join(RAW_DIR, '15-precision-labels.json'), 'utf8'));
const labels = labelDoc.labels || labelDoc;

const norm = (s) => String(s == null ? '' : s).trim();

function precision(skills, roleLabels) {
  let relevant = 0;
  let unlabelled = 0;
  for (const s of skills) {
    const v = roleLabels ? roleLabels[s] : undefined;
    if (v === 'yes') relevant += 1;
    else if (v !== 'no') unlabelled += 1;
  }
  return {
    relevant,
    n: skills.length,
    unlabelled,
    // Denominator is the model's list length, not the labelled subset: an
    // unlabelled skill counts against the model rather than being dropped,
    // which is the conservative reading.
    precision: skills.length ? relevant / skills.length : null,
  };
}

const rows = [];
let totalLabelled = 0;
let totalSkills = 0;

for (const entry of key.entries) {
  const roleLabels = labels[entry.title];
  const live = precision(entry.live_top10, roleLabels);
  const backup = precision(entry.backup_top10, roleLabels);
  const marked = entry.merged.filter((s) => roleLabels && (roleLabels[s] === 'yes' || roleLabels[s] === 'no')).length;
  totalLabelled += marked;
  totalSkills += entry.merged.length;
  rows.push({
    title: entry.title,
    live: live.precision,
    liveRelevant: live.relevant,
    liveN: live.n,
    backup: backup.precision,
    backupRelevant: backup.relevant,
    backupN: backup.n,
    delta: live.precision != null && backup.precision != null ? live.precision - backup.precision : null,
    labelledOfMerged: `${marked}/${entry.merged.length}`,
  });
}

const avg = (f) => {
  const v = rows.map(f).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const summary = {
  generatedAt: new Date().toISOString(),
  annotator: 'single annotator (blind, merged two-model list)',
  liveArtifact: key.live_artifact,
  backupArtifact: key.backup_artifact,
  config: key.config,
  roles: rows.length,
  skillsMarked: `${totalLabelled}/${totalSkills}`,
  meanPrecisionAt10: { live: avg((r) => r.live), backup: avg((r) => r.backup) },
  rolesImproved: rows.filter((r) => r.delta > 0).length,
  rolesRegressed: rows.filter((r) => r.delta < 0).length,
  rolesUnchanged: rows.filter((r) => r.delta === 0).length,
};

const pc = (x) => (x == null ? ' n/a ' : `${(x * 100).toFixed(0)}%`);

console.log('=== model 1: precision@10 (blind single-annotator) ===\n');
console.log(`skills marked: ${summary.skillsMarked}\n`);
console.log('role                            live   pre-M06   delta');
for (const r of rows.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))) {
  const d = r.delta == null ? ' n/a' : `${r.delta > 0 ? '+' : ''}${(r.delta * 100).toFixed(0)}pp`;
  console.log(
    `${r.title.slice(0, 30).padEnd(31)} ${pc(r.live).padStart(5)}   ${pc(r.backup).padStart(6)}   ${d.padStart(6)}`
  );
}
console.log('\nmean precision@10:');
console.log(`  live model    : ${pc(summary.meanPrecisionAt10.live)}`);
console.log(`  pre-M06 backup: ${pc(summary.meanPrecisionAt10.backup)}`);
const delta = summary.meanPrecisionAt10.live - summary.meanPrecisionAt10.backup;
console.log(`  change        : ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)} percentage points`);
console.log(`\nroles improved ${summary.rolesImproved} · regressed ${summary.rolesRegressed} · unchanged ${summary.rolesUnchanged}`);
console.log('\nwritten:', writeRaw('16-precision-results.json', { summary, rows }));
