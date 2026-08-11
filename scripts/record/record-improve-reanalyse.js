/**
 * Improve + re-analyse on their own, with the honest level picker so the
 * "we recommend not adding it" warning appears on camera.
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-improve-reanalyse.js
 */
const fs = require('fs');
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const DL    = path.resolve(__dirname, '../../docs/final-sprint/outputs/marketing/exports');
const CV    = path.resolve(__dirname, '../../test-fixtures/authentic-cvs/pdfs/frontend-mid-strong_Noa-Shapiro.pdf');
const JD    = path.resolve(__dirname, 'jd-frontend.txt');
const EMAIL = process.env.REC_EMAIL || 'demo@careerlens.dev';
const PW    = process.env.REC_PASSWORD || 'DemoRecord!2026';

(async () => {
  fs.mkdirSync(DL, { recursive: true });
  const token = await R.login(EMAIL, PW);
  const { browser, ctx, page } = await R.openRecorder({ outDir: OUT });
  const { mark, marks } = R.makeMarker();
  page.on('download', async (d) => { await d.saveAs(path.join(DL, d.suggestedFilename())).catch(() => {}); });

  let before = '?', after = '?', saved = 0, total = 0, warning = false;

  try {
    // --- get to a dashboard quickly; the analysis itself is cut out later ---
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.click(page, page.getByRole('button', { name: /start analyzing/i }).first(), 'Start');
    await R.settled(page);
    const saveToggle = page.locator('input[type="checkbox"]').first();
    if (await saveToggle.count()) await saveToggle.uncheck({ force: true }).catch(() => {});
    await page.locator('input[type="file"]').first().setInputFiles(CV);
    await R.expectText(page, /detected role/i, 30);
    const ta = page.locator('textarea').first();
    await ta.click(); await ta.fill(fs.readFileSync(JD, 'utf8'));
    await R.hold(page, 1.5);
    mark('00 CUT_START setup');
    let ok = false;
    for (let a = 1; a <= 3 && !ok; a++) {
      await R.click(page, page.getByRole('button', { name: /analy[sz]e match/i }).first(), 'Analyze');
      ok = await R.waitDashboard(page);
    }
    if (!ok) throw new Error('no dashboard');
    await R.settled(page); await R.scrollTop(page);
    await R.hold(page, 4); before = await R.scoreOf(page);
    mark(`01 CUT_END  score before = ${before}%`);
    await R.hold(page, 3);

    // --- improve ---
    await R.click(page, page.getByRole('button', { name: /improve your cv/i }).first(), 'Improve');
    await R.settled(page);
    await R.hold(page, 4); mark('02 RATE your skill levels');

        const chosen = await R.pickHonestLevels(page, { notMine: ['angular'] });
    total = chosen.length;
    mark(`03 levels set from the analysis (${total} skills)`);
    await R.hold(page, 4);

    // the product's own guard-rail: a 0/10 skill marked "No knowledge"
    warning = /we recommend not adding it|not found in your cv/i.test(await R.bodyText(page));
    if (warning) { mark('04 WARNING "we recommend not adding it"'); await R.hold(page, 5); }

    await R.click(page, page.getByRole('button', { name: /^continue|next →|^next$/i }).first(), 'Continue');
    mark('05 REPHRASE original vs rephrased');

    for (let i = 1; i <= Math.max(total, 1); i++) {
      await R.settled(page);
      await R.hold(page, 2);
      const save = page.getByRole('button', { name: /^save$/i }).first();
      if (await save.count()) {
        await save.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
        await R.hold(page, 0.9);
        await save.click({ force: true }).catch(() => {});
      }
      if (await R.expectText(page, /\bSaved\b/, 20)) { saved++; mark(`   skill ${i} SAVED`); }
      await R.hold(page, 2);
      const next = page.getByRole('button', { name: /^next/i }).first();
      if (!(await next.count())) break;
      if (await next.evaluate((el) => el.disabled).catch(() => true)) break;
      await next.click({ force: true }).catch(() => {});
      await R.hold(page, 1.5);
    }
    mark(`06 saved ${saved}`);

    if (await R.click(page, page.getByRole('button', { name: /submit changes/i }).first(), 'Submit')) {
      await R.settled(page);
      await R.hold(page, 5); mark('07 improved CV ready'); await R.hold(page, 3);
      await R.click(page, page.getByRole('button', { name: /^export/i }).first(), 'Export');
      await R.hold(page, 3); mark('08 exported');

      if (await R.click(page, page.getByRole('button', { name: /re-?analyz/i }).first(), 'Re-analyze')) {
        mark('09 CUT_START re-analysing');
        if (await R.waitDashboard(page, 180)) {
          await R.settled(page); await R.scrollTop(page);
          await R.hold(page, 5); after = await R.scoreOf(page);
          mark(`10 CUT_END  score after = ${after}%`);
          await R.hold(page, 4);
          await R.glide(page, 330, 2400);
          await R.hold(page, 4); mark('11 skills after');
        }
      }
    }
    await R.hold(page, 2); mark('12 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    console.log(`\nBEFORE=${before}%  AFTER=${after}%  saved=${saved}/${total}  warning=${warning}`);
    await R.finish({ ctx, browser, page, outDir: OUT, name: '16-improve-and-reanalyse', marks,
                     extra: { before, after, saved, total, warning } });
  }
})();
