/**
 * An out-of-domain CV (a nurse) is not forced into a software role.
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-out-of-domain.js
 */
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const NURSE = path.resolve(__dirname, '../../test-fixtures/nurse-cv.pdf');
const EMAIL = process.env.REC_EMAIL || 'demo@careerlens.dev';
const PW    = process.env.REC_PASSWORD || 'DemoRecord!2026';

(async () => {
  const token = await R.login(EMAIL, PW);
  const { browser, ctx, page } = await R.openRecorder({ outDir: OUT });
  const { mark, marks } = R.makeMarker();

  try {
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.hold(page, 1.5);

    await R.click(page, page.getByRole('button', { name: /start analyzing/i }).first(), 'Start');
    await R.settled(page);
    await R.hold(page, 2); mark('01 upload screen');

    await page.locator('input[type="file"]').first().setInputFiles(NURSE);
    await R.expectText(page, /detected role/i, 30);
    await R.settled(page);
    await R.hold(page, 3);
    mark('02 nurse CV read');
    const m = (await R.bodyText(page)).match(/Detected role(.{0,160})/i);
    console.log('     ', m ? m[1].trim() : '(not found)');
    await R.hold(page, 5); mark('03 hold on the refusal');

    if (await R.click(page, page.getByRole('button', { name: /choose it manually|not the right role/i }).first(), 'Manual picker')) {
      await R.settled(page);
      await R.hold(page, 3); mark('04 manual role picker');
      await R.glide(page, 220, 1800);
      await R.hold(page, 3); mark('05 role list');
    }
    await R.hold(page, 2); mark('06 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    await R.finish({ ctx, browser, page, outDir: OUT, name: '11-out-of-domain-headless-1080p', marks });
  }
})();
