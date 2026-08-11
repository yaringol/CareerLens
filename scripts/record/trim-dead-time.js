/**
 * Cut the dead waiting out of a recording using its own cut sheet.
 *
 * Keeps at most `maxHold` seconds after each MARK and drops every CUT_START -> CUT_END
 * span entirely (those are the analysis spinners). Everything else is untouched, so the
 * result is the same footage with the boredom removed - no speed-ramping, no fakery.
 *
 *   node scripts/record/trim-dead-time.js <video.webm> [maxHold]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG_PATH ||
  'C:/Users/may20/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');

const video   = process.argv[2];
const maxHold = Number(process.argv[3] || 6);
if (!video || !fs.existsSync(video)) {
  console.error('usage: node trim-dead-time.js <video.webm> [maxHold seconds]');
  process.exit(1);
}
const sheetPath = video.replace(/\.webm$/i, '.cut-sheet.json');
if (!fs.existsSync(sheetPath)) { console.error('no cut sheet next to the video'); process.exit(1); }

const sheet = JSON.parse(fs.readFileSync(sheetPath, 'utf8'));
const marks = sheet.marks || [];
const duration = Number(execFileSync(FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim());

// build keep-windows: from each mark, up to maxHold seconds or until the next mark
const keep = [];
for (let i = 0; i < marks.length; i++) {
  const m = marks[i];
  const next = marks[i + 1] ? marks[i + 1].t : duration;
  if (/CUT_START/i.test(m.label)) continue;               // spinner span begins - skip it
  const end = Math.min(next, m.t + maxHold);
  if (end - m.t < 0.4) continue;
  const last = keep[keep.length - 1];
  if (last && m.t - last.end < 0.35) last.end = end;      // merge touching windows
  else keep.push({ start: m.t, end, label: m.label });
}

const kept = keep.reduce((s, k) => s + (k.end - k.start), 0);
console.log(`${path.basename(video)}  ${duration.toFixed(1)}s -> ${kept.toFixed(1)}s  (${keep.length} windows)`);
keep.forEach((k) => console.log(`   ${k.start.toFixed(1).padStart(7)} - ${k.end.toFixed(1).padStart(7)}  ${k.label}`));

const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'trim-'));
const parts = keep.map((k, i) => {
  const out = path.join(work, `p${String(i).padStart(3, '0')}.mp4`);
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(k.start), '-t', String(k.end - k.start),
    '-i', video, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', '19', '-an', out]);
  return out;
});
const list = path.join(work, 'list.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
const dest = video.replace(/\.webm$/i, '-trimmed.mp4');
execFileSync(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', dest]);
fs.rmSync(work, { recursive: true, force: true });
console.log(`\ntrimmed -> ${dest}`);
