/* Validate every PDF in pdfs/ against manifest + pipeline constraints.
   Mirrors backend/src/services/cv.service.ts logic (pdf-parse v2, normalize, header window).
   Run: node validate.cjs   (from this folder) */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('c:/Git/CareerLens/backend/node_modules/pdf-parse');

const BASE = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(BASE, 'manifest.json'), 'utf8'));

function normalize(text) {
  return text.toLowerCase().replace(/[\n\r\t]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function headerLines(raw, maxLines = 25) {
  return raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && l.length <= 200).slice(0, maxLines).join('\n');
}

(async () => {
  let fail = 0;
  for (const cv of manifest.cvs) {
    const p = path.join(BASE, 'pdfs', cv.file);
    const issues = [];
    if (!fs.existsSync(p)) { console.log(`MISSING  ${cv.file}`); fail++; continue; }
    const size = fs.statSync(p).size;
    if (size > 8 * 1024 * 1024) issues.push(`size ${size}B > 8MB`);
    let raw = '';
    try {
      const parser = new PDFParse({ data: fs.readFileSync(p) });
      const data = await parser.getText();
      raw = (data.text || '').trim();
      await parser.destroy();
    } catch (e) { issues.push(`parse error: ${e.message}`); }

    const norm = normalize(raw);
    if (cv.scenario === 'scanned') {
      // pdf-parse injects a "-- 1 of 1 --" page marker even for image-only PDFs.
      // The real pipeline gate is: normalized < 50 chars -> rejected. Mirror that.
      if (norm.length >= 50) issues.push(`scanned fixture has real text layer (${norm.length} normalized chars >= 50)`);
    } else {
      if (norm.length < 50) issues.push(`normalized text ${norm.length} chars < 50`);
      // name (from filename) must appear in header window
      const person = cv.file.split('_').slice(1, -0).join(' ');
      const nameGuess = cv.file.replace('.pdf', '').split('_')[1]?.replace(/-/g, ' ');
      const header = headerLines(raw).toLowerCase();
      if (nameGuess && !header.includes(nameGuess.toLowerCase().split(' ')[0])) {
        issues.push(`first name '${nameGuess.split(' ')[0]}' not in first 25 lines`);
      }
      if (cv.scenario === 'clear-cut' && cv.true_title !== 'none') {
        // clear-cut personas must state their domain; ambiguous/junior/hybrid may
        // legitimately omit the literal title keyword (that IS the hard case).
        const kw = cv.true_title.split(' ')[0].toLowerCase();
        if (!norm.includes(kw.toLowerCase())) issues.push(`title keyword '${kw}' absent from text`);
      }
      if (cv.scenario === 'hebrew') {
        const latin = (raw.match(/[a-zA-Z]/g) || []).length;
        const heb = (raw.match(/[֐-׿]/g) || []).length;
        if (heb < latin) issues.push(`hebrew fixture is mostly Latin (${heb} heb vs ${latin} latin)`);
      }
    }
    if (issues.length) { console.log(`FAIL ${cv.file}\n   - ${issues.join('\n   - ')}`); fail++; }
    else console.log(`OK   ${cv.file} (${raw.length} chars raw)`);
  }
  console.log(fail ? `\n${fail} file(s) failed` : '\nAll files passed');
  process.exit(fail ? 1 : 0);
})();
