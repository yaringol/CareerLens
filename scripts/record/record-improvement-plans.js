/**
 * Improvement Plans on an account that actually has a history of them.
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-improvement-plans.js
 */
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const EMAIL = process.env.PLANS_EMAIL || 'integtest@careerlens.dev';
const PW    = process.env.PLANS_PASSWORD || 'PlansRecord!2026';

(async () => {
  const token = await R.login(EMAIL, PW);
  const { browser, ctx, page } = await R.openRecorder({ outDir: OUT });
  const { mark, marks } = R.makeMarker();
  let planCount = '?';

  try {
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.hold(page, 1.5);

    if (!(await R.click(page, page.getByRole('link', { name: /account/i }).first(), 'Account'))) {
      await R.click(page, page.getByRole('button', { name: /my account/i }).first(), 'My Account');
    }
    await R.settled(page);
    await R.hold(page, 3); mark('01 account');

    const tab = page.getByText(/improvement plans/i).first();
    if (await tab.count()) {
      await tab.click({ force: true }).catch(() => {});
      await R.settled(page);
      await R.hold(page, 4);
      const m = (await R.bodyText(page)).match(/Improvement Plans\s*(\d+)/i);
      planCount = m ? m[1] : '?';
      mark(`02 IMPROVEMENT PLANS (${planCount})`);
      await R.hold(page, 3);

      // walk the list slowly - this is the point of the shot
      for (let i = 0; i < 4; i++) {
        await R.glide(page, 300, 2200);
        await R.hold(page, 2.5);
        mark(`03 plans scroll ${i + 1}`);
      }
      // open one plan if the rows expand
      const first = page.locator('button, [role="button"]').filter({ hasText: /view|open|details/i }).first();
      if (await first.count()) {
        await first.click({ force: true }).catch(() => {});
        await R.settled(page);
        await R.hold(page, 5); mark('04 one plan opened');
      }
    } else {
      console.log('     !! no Improvement Plans tab');
    }
    await R.hold(page, 2); mark('05 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    console.log(`\nplans: ${planCount}`);
    await R.finish({ ctx, browser, page, outDir: OUT, name: '14-improvement-plans-history', marks,
                     extra: { planCount, account: EMAIL } });
  }
})();
