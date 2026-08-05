/**
 * Generates 15 CV PDFs (5 roles × 3 levels) into the ./cvs/ directory.
 * Run: node generate_pdfs.js
 *
 * Requires: npm install (pdfkit)
 */

'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { CV_DATA } = require('./cv_content');

const OUTPUT_DIR = path.join(__dirname, 'cvs');
const MARGIN = 50;
const PAGE_WIDTH = 595.28 - MARGIN * 2; // A4 usable width

// ── PDF helpers ───────────────────────────────────────────────────────────────
// Intentionally avoid vector-drawing operations (moveTo/lineTo/stroke) and
// continued:true text chains — these can produce bad XRef entries in pdfkit.

function sectionHeader(doc, title) {
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').text(title.toUpperCase());
  doc.fontSize(9).font('Helvetica').text('─'.repeat(85));
  doc.moveDown(0.2);
}

function bodyText(doc, text) {
  doc.fontSize(10).font('Helvetica').text(text, { paragraphGap: 2 });
}

function experienceBlock(doc, item) {
  doc.fontSize(10).font('Helvetica-Bold').text(`${item.company}  |  ${item.role}  |  ${item.dates}`);
  for (const bullet of item.bullets) {
    doc.fontSize(10).font('Helvetica').text(`•  ${bullet}`, { indent: 14, paragraphGap: 1 });
  }
  doc.moveDown(0.4);
}

function educationBlock(doc, item) {
  doc.fontSize(10).font('Helvetica').text(`${item.degree}  |  ${item.institution}  |  ${item.year}`);
}

// ── Main PDF builder ──────────────────────────────────────────────────────────

function generateCVPDF(cv, outputPath) {
  return new Promise((resolve, reject) => {
    // compress:false avoids pdfkit XRef table corruption on some PDF sizes
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', compress: false });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ── Header ────────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(cv.name, { align: 'center' });
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#555555')
      .text(cv.contact, { align: 'center' });

    // ── Professional Summary ──────────────────────────────────────────────────
    sectionHeader(doc, 'Professional Summary');
    bodyText(doc, cv.summary);

    // ── Work Experience ───────────────────────────────────────────────────────
    sectionHeader(doc, 'Work Experience');
    for (const item of cv.experience) {
      experienceBlock(doc, item);
    }

    // ── Education ─────────────────────────────────────────────────────────────
    sectionHeader(doc, 'Education');
    for (const item of cv.education) {
      educationBlock(doc, item);
    }

    // ── Skills ────────────────────────────────────────────────────────────────
    sectionHeader(doc, 'Skills');
    bodyText(doc, cv.skills);

    // ── Projects & Achievements ───────────────────────────────────────────────
    if (cv.projects) {
      sectionHeader(doc, 'Projects & Achievements');
      bodyText(doc, cv.projects);
    }

    // ── Certifications ────────────────────────────────────────────────────────
    if (cv.certifications) {
      sectionHeader(doc, 'Certifications');
      bodyText(doc, cv.certifications);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jobTitles = Object.keys(CV_DATA);
  const levels = ['weak', 'mid', 'strong'];
  let generated = 0;

  console.log('Generating CV PDFs...\n');

  for (const jobTitle of jobTitles) {
    for (const level of levels) {
      const cv = CV_DATA[jobTitle][level];
      const fileName = `${jobTitle.replace(/ /g, '_')}_${level}.pdf`;
      const outputPath = path.join(OUTPUT_DIR, fileName);

      await generateCVPDF(cv, outputPath);
      const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
      console.log(`  ✓  ${fileName.padEnd(40)} (${sizeKB} KB)`);
      generated++;
    }
  }

  // Verify all PDFs are parseable; regenerate up to 3 times if not
  console.log('\nVerifying PDFs are parseable...');
  for (const jobTitle of jobTitles) {
    for (const level of levels) {
      const cv = CV_DATA[jobTitle][level];
      const fileName = `${jobTitle.replace(/ /g, '_')}_${level}.pdf`;
      const outputPath = path.join(OUTPUT_DIR, fileName);

      let ok = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const buf = fs.readFileSync(outputPath);
          await pdfParse(buf);
          ok = true;
          break;
        } catch {
          process.stdout.write(`  ↻ ${fileName} parse failed, regenerating (attempt ${attempt})...\n`);
          await generateCVPDF(cv, outputPath);
        }
      }
      if (!ok) console.error(`  ✗ ${fileName} could not be fixed — manual inspection needed`);
    }
  }

  console.log(`\n${generated} PDFs written to: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Error generating PDFs:', err.message);
  process.exit(1);
});
