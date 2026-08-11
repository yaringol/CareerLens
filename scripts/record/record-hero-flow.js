/**
 * The hero take for the video.
 *
 * Scenario chosen deliberately, not at random: Dana Peled is a manual-QA tester moving
 * into automation. Every skill the analysis lists is genuinely hers - the CV simply
 * words them badly - which is exactly the case the product exists for, and which makes
 * an "Expert" self-rating defensible on every row. Nothing here is a skill the CV
 * contradicts, so no Angular-style fabrication is possible.
 *
 *   node scripts/record/record-hero-flow.js
 */
const fs = require('fs');
const path = require('path');
const R = require('./recorder');

const OUT   = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const DL    = path.resolve(__dirname, '../../docs/final-sprint/outputs/marketing/exports');
const CV    = path.resolve(__dirname, '../../test-fixtures/authentic-cvs/pdfs/qa-to-automation-mid-careerchange_Dana-Peled.pdf');
const JD    = path.resolve(__dirname, 'jd-qa-automation.txt');
const EMAIL = process.env.REC_EMAIL || 'demo@careerlens.dev';
const PW    = process.env.REC_PASSWORD || 'DemoRecord!2026';
const TAKE  = process.env.TAKE || '1';

(async () => {
  fs.mkdirSync(DL, { recursive: true });
  const token = await R.login(EMAIL, PW);
  const { browser, ctx, page } = await R.openRecorder({ outDir: OUT });
  const { mark, marks } = R.makeMarker();
  page.on('download', async (d) => { await d.saveAs(path.join(DL, d.suggestedFilename())).catch(() => {}); });

  let before = '?', after = '?', saved = 0, total = 0;

  try {
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.hold(page, 2.5); mark('01 LANDING');
    await R.glide(page, 620, 2400);
    await R.hold(page, 2.5); mark('02 how it works');
    await R.glide(page, -620, 1800);

    await R.click(page, page.getByRole('button', { name: /start analyzing/i }).first(), 'Start');
    await R.settled(page);
    const saveToggle = page.locator('input[type="checkbox"]').first();
    if (await saveToggle.count()) await saveToggle.uncheck({ force: true }).catch(() => {});
    await R.hold(page, 2); mark('03 UPLOAD empty');

    await page.locator('input[type="file"]').first().setInputFiles(CV);
    await R.expectText(page, /detected role/i, 30);
    await R.settled(page);
    await R.hold(page, 4); mark('04 ROLE DETECTED');

    const ta = page.locator('textarea').first();
    await ta.click();
    await ta.fill(fs.readFileSync(JD, 'utf8'));
    await R.hold(page, 2.5); mark('05 JOB POSTING');

    if (await R.click(page, page.getByRole('button', { name: /customize recommendations/i }).first(), 'Customize')) {
      await R.settled(page);
      await R.hold(page, 3); mark('06 PERSONALIZE');
      for (const n of ['Stable', 'Trending', 'Balanced']) {
        const el = page.getByText(new RegExp(`^${n}$`, 'i')).first();
        if (await el.count()) { await el.click({ force: true }).catch(() => {}); await R.hold(page, 2.4); mark(`07 ${n}`); }
      }
      await R.hold(page, 1.5);
      for (const rx of [/analyze with preferences/i, /skip and use standard results/i, /back to upload/i]) {
        const b = page.getByRole('button', { name: rx }).first();
        if (!(await b.count())) continue;
        if (await b.evaluate((el) => el.disabled).catch(() => false)) continue;
        await b.click({ force: true }).catch(() => {});
        await R.hold(page, 2); mark('08 left personalize');
        break;
      }
    }

    mark('09 CUT_START analysing');
    let ok = await R.waitDashboard(page, 25);
    for (let a = 1; a <= 3 && !ok; a++) {
      await R.click(page, page.getByRole('button', { name: /analy[sz]e match/i }).first(), 'Analyze Match');
      ok = await R.waitDashboard(page);
    }
    if (!ok) throw new Error('no dashboard');
    await R.settled(page);
    mark('10 CUT_END');

    await R.scrollTop(page);
    await R.hold(page, 5); before = await R.scoreOf(page); mark(`11 SCORE BEFORE = ${before}%`);
    await R.hold(page, 3);
    await R.glide(page, 330, 2400); await R.hold(page, 4); mark('12 SKILL columns');
    await R.glide(page, 500, 2600); await R.hold(page, 5); mark('13 GAP analysis');
    await R.glide(page, 300, 2000); await R.hold(page, 4); mark('14 GAP rows');

    await R.click(page, page.getByRole('button', { name: /improve your cv/i }).first(), 'Improve');
    await R.settled(page);
    await R.hold(page, 4); mark('15 RATE skill levels');

    // every listed skill is genuinely hers - see the header note
    const chosen = await R.pickHonestLevels(page, { allExpert: true });
    total = chosen.length;
    mark(`16 levels set (${total} skills)`);
    await R.hold(page, 3);

    await R.click(page, page.getByRole('button', { name: /^continue|next →|^next$/i }).first(), 'Continue');
    mark('17 REPHRASE');

    // A skill can have several "Mention" tabs, so step until Submit appears -
    // counting skills is not enough (that is why Submit was never reached before).
    let steps = 0;
    for (steps = 0; steps < 30; steps++) {
      await R.settled(page);
      await R.hold(page, 1.2);

      const save = page.getByRole('button', { name: /^save$/i }).first();
      if ((await save.count()) && !(await save.evaluate((el) => el.disabled).catch(() => true))) {
        await save.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
        await R.hold(page, 0.8);
        await save.click({ force: true }).catch(() => {});
        if (await R.expectText(page, /\bSaved\b/, 20)) { saved++; mark(`   step ${steps + 1} SAVED`); }
      }
      await R.hold(page, 1.2);

      const sub = page.getByRole('button', { name: /submit changes/i }).first();
      if ((await sub.count()) && !(await sub.evaluate((el) => el.disabled).catch(() => true))) break;

      const next = page.getByRole('button', { name: /^next/i }).first();
      if (!(await next.count())) break;
      if (await next.evaluate((el) => el.disabled).catch(() => true)) break;
      await next.click({ force: true }).catch(() => {});
      await R.hold(page, 1.3);
    }
    mark(`18 saved ${saved} across ${steps + 1} steps (${total} skills)`);

    // Submit sits at the bottom and stays disabled until every skill is handled
    await R.glide(page, 400, 1200);
    await R.hold(page, 1.5);
    const submit = page.getByRole('button', { name: /submit changes|submit|finish|see result/i }).first();
    for (let i = 0; i < 20; i++) {
      if ((await submit.count()) && !(await submit.evaluate((el) => el.disabled).catch(() => true))) break;
      await R.hold(page, 1);
    }
    if (!(await submit.count())) {
      const btns = await page.$$eval('button', (els) =>
        els.filter((e) => e.offsetParent).map((e) => `${e.innerText.trim().slice(0, 24)}${e.disabled ? '[X]' : ''}`));
      console.log('     buttons here:', btns.join(' | '));
    }
    if (await R.click(page, submit, 'Submit')) {
      await R.settled(page);
      await R.hold(page, 5); mark('19 RESULT'); await R.hold(page, 3);
      await R.click(page, page.getByRole('button', { name: /^export/i }).first(), 'Export');
      await R.hold(page, 3); mark('20 EXPORT');
      if (await R.click(page, page.getByRole('button', { name: /re-?analyz/i }).first(), 'Re-analyze')) {
        mark('21 CUT_START re-analysing');
        if (await R.waitDashboard(page, 180)) {
          await R.settled(page); await R.scrollTop(page);
          await R.hold(page, 5); after = await R.scoreOf(page); mark(`22 SCORE AFTER = ${after}%`);
          await R.hold(page, 4);
          await R.glide(page, 330, 2200); await R.hold(page, 4); mark('23 skills after');
        }
      }
    }
    await R.hold(page, 2); mark('24 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    const delta = (after !== '?' && before !== '?') ? (+after - +before) : null;
    console.log(`\nTAKE ${TAKE}   BEFORE=${before}%  AFTER=${after}%  delta=${delta > 0 ? '+' : ''}${delta}  saved=${saved}/${total}`);
    await R.finish({ ctx, browser, page, outDir: OUT, name: `20-hero-qa-automation-take${TAKE}`, marks,
                     extra: { before, after, delta, saved, total, cv: path.basename(CV) } });
  }
})();
