/**
 * Personalization on its own: what each preset means, and the dynamic-skill picker.
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-personalize.js
 */
const fs = require('fs');
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const CV    = path.resolve(__dirname, '../../test-fixtures/authentic-cvs/pdfs/frontend-mid-strong_Noa-Shapiro.pdf');
const JD    = path.resolve(__dirname, 'jd-frontend.txt');
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
    const saveToggle = page.locator('input[type="checkbox"]').first();
    if (await saveToggle.count()) await saveToggle.uncheck({ force: true }).catch(() => {});

    await page.locator('input[type="file"]').first().setInputFiles(CV);
    await R.expectText(page, /detected role/i, 30);
    await R.settled(page);
    await R.hold(page, 2.5); mark('01 CV + role');

    const ta = page.locator('textarea').first();
    await ta.click();
    await ta.fill(fs.readFileSync(JD, 'utf8'));
    await R.hold(page, 2); mark('02 job posting');

    await R.click(page, page.getByRole('button', { name: /customize recommendations/i }).first(), 'Customize');
    await R.settled(page);
    await R.hold(page, 5); mark('03 TAILOR YOUR RECOMMENDATIONS');

    // each preset gets its own beat, with the explanation line under it
    for (const n of ['Stable', 'Trending', 'Balanced', 'Custom']) {
      const el = page.getByText(new RegExp(`^${n}$`, 'i')).first();
      if (!(await el.count())) { console.log(`     (no ${n})`); continue; }
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await R.hold(page, 0.8);
      await el.click({ force: true }).catch(() => {});
      await R.settled(page);
      await R.hold(page, 4); mark(`04 preset ${n}`);
    }

    // the "remember this balance" toggle
    const remember = page.getByText(/remember this balance/i).first();
    if (await remember.count()) {
      await remember.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await R.hold(page, 1);
      await remember.click({ force: true }).catch(() => {});
      await R.hold(page, 3); mark('05 remember this balance');
    }

    // the dynamic-skill chips extracted from the posting
    await R.glide(page, 260, 2000);
    await R.hold(page, 4); mark('06 DYNAMIC SKILLS picker');
    const chips = page.locator('button').filter({ hasText: /^[a-z][a-z0-9 .+#/-]{2,28}$/i });
    const n = Math.min(3, await chips.count());
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click({ force: true }).catch(() => {});
      await R.hold(page, 1.6);
    }
    mark('07 chips toggled');
    await R.hold(page, 3);
    mark('08 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    await R.finish({ ctx, browser, page, outDir: OUT, name: '15-personalize-deep-dive', marks });
  }
})();
