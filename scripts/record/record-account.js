/**
 * Account: CV library, improvement plans, security.
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-account.js
 */
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
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

    // enter through the header link, not by URL (rule 6)
    if (!(await R.click(page, page.getByRole('link', { name: /account/i }).first(), 'Account link'))) {
      await R.click(page, page.getByRole('button', { name: /my account/i }).first(), 'My Account');
    }
    await R.settled(page);
    await R.hold(page, 4); mark('01 CV library');
    await R.glide(page, 260, 2200);
    await R.hold(page, 3); mark('02 library scrolled');
    await R.glide(page, -260, 1600);

    for (const [rx, label] of [[/improvement plans/i, '03 improvement plans'],
                               [/security/i, '04 security']]) {
      const tab = page.getByText(rx).first();
      if (!(await tab.count())) { console.log(`     (no ${label} tab)`); continue; }
      await tab.click({ force: true }).catch(() => {});
      await R.settled(page);
      await R.hold(page, 4); mark(label);
    }
    await R.hold(page, 2); mark('05 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    await R.finish({ ctx, browser, page, outDir: OUT, name: '12-account-headless-1080p', marks });
  }
})();
