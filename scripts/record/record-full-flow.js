/**
 * Full CareerLens walkthrough for the explainer video.
 * Rules and rationale: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-full-flow.js
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

  page.on('download', async (d) => {
    await d.saveAs(path.join(DL, d.suggestedFilename())).catch(() => {});
    console.log(`     downloaded ${d.suggestedFilename()}`);
  });

  let before = '?', after = '?', saved = 0, total = 0;

  try {
    // seed the token, then always enter through the UI (rule 6)
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.hold(page, 2.5); mark('01 LANDING');

    await R.glide(page, 620, 2600);
    await R.hold(page, 2.5); mark('02 LANDING how-it-works');
    await R.glide(page, -620, 2000);

    await R.click(page, page.getByRole('button', { name: /start analyzing/i }).first(), 'Start');
    await R.settled(page);
    await R.hold(page, 2.5); mark('03 UPLOAD empty');

    await page.locator('input[type="file"]').first().setInputFiles(CV);
    await R.expectText(page, /detected role/i, 30);
    await R.settled(page);
    await R.hold(page, 4); mark('04 ROLE DETECTED');

    const ta = page.locator('textarea').first();
    await ta.click();
    await ta.fill(fs.readFileSync(JD, 'utf8'));
    await R.hold(page, 3); mark('05 JOB POSTING');

    if (await R.click(page, page.getByRole('button', { name: /customize recommendations/i }).first(), 'Customize')) {
      await R.settled(page);
      await R.hold(page, 3.5); mark('06 PERSONALIZE');
      for (const n of ['Stable', 'Trending', 'Balanced']) {
        const el = page.getByText(new RegExp(`^${n}$`, 'i')).first();
        if (await el.count()) { await el.click({ force: true }).catch(() => {}); await R.hold(page, 2.6); mark(`07 preset ${n}`); }
      }
      await R.hold(page, 2);
      for (const [rx, label] of [[/analyze with preferences/i, 'Analyze with preferences'],
                                 [/skip and use standard results/i, 'Skip and use standard'],
                                 [/back to upload/i, 'Back to upload']]) {
        const b = page.getByRole('button', { name: rx }).first();
        if (!(await b.count())) continue;
        if (await b.evaluate((el) => el.disabled).catch(() => false)) continue;
        await b.click({ force: true }).catch(() => {});
        await R.hold(page, 2.5); mark(`08 left personalize via "${label}"`);
        break;
      }
    }

    mark('09 CUT_START analysing');
    let ok = await R.waitDashboard(page, 25);
    for (let a = 1; a <= 3 && !ok; a++) {
      await R.click(page, page.getByRole('button', { name: /analy[sz]e match/i }).first(), 'Analyze Match');
      ok = await R.waitDashboard(page);
    }
    if (!ok) throw new Error('dashboard never rendered');
    await R.settled(page);
    mark('10 CUT_END dashboard');

    await R.scrollTop(page);
    await R.hold(page, 5); before = await R.scoreOf(page); mark(`11 SCORE BEFORE = ${before}%`);
    await R.hold(page, 3);
    await R.glide(page, 330, 2600); await R.hold(page, 4); mark('12 SKILL columns');
    await R.glide(page, 500, 2800); await R.hold(page, 5); mark('13 GAP analysis');
    await R.glide(page, 300, 2200); await R.hold(page, 4); mark('14 GAP rows');

    await R.click(page, page.getByRole('button', { name: /improve your cv/i }).first(), 'Improve');
    await R.settled(page);
    await R.hold(page, 4); mark('15 RATE skill levels');

        // Angular is the one skill this React developer genuinely does not have.
    const chosen = await R.pickHonestLevels(page, { notMine: ['angular'] });
    total = chosen.length;
    mark(`16 levels set honestly (${total} skills)`);
    await R.hold(page, 3);

    await R.click(page, page.getByRole('button', { name: /^continue|next →|^next$/i }).first(), 'Continue');
    mark('17 REPHRASE screen');

    // one verified save per skill (rule 4 + 5)
    for (let i = 1; i <= total; i++) {
      await R.settled(page);
      await R.hold(page, 1.5);
      const save = page.getByRole('button', { name: /^save$/i }).first();
      if (await save.count()) {
        await save.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
        await R.hold(page, 0.8);
        await save.click({ force: true }).catch(() => {});
      }
      if (await R.expectText(page, /\bSaved\b/, 20)) { saved++; mark(`   skill ${i}/${total} SAVED`); }
      else console.log(`     !! skill ${i}/${total} did NOT save`);
      await R.hold(page, 1.8);
      if (i < total) {
        const next = page.getByRole('button', { name: /^next/i }).first();
        if (!(await next.count())) break;
        await next.click({ force: true }).catch(() => {});
        await R.hold(page, 1.5);
      }
    }
    mark(`18 saved ${saved}/${total}`);
    await R.hold(page, 2);

    if (await R.click(page, page.getByRole('button', { name: /submit changes/i }).first(), 'Submit')) {
      await R.settled(page);
      await R.hold(page, 5); mark('19 RESULT improved CV'); await R.hold(page, 3);
      if (await R.click(page, page.getByRole('button', { name: /^export/i }).first(), 'Export')) {
        await R.hold(page, 3.5); mark('20 EXPORT');
      }
      if (await R.click(page, page.getByRole('button', { name: /re-?analyz/i }).first(), 'Re-analyze')) {
        mark('21 CUT_START re-analysing');
        if (await R.waitDashboard(page, 180)) {
          await R.settled(page);
          await R.scrollTop(page);
          await R.hold(page, 5); after = await R.scoreOf(page); mark(`22 SCORE AFTER = ${after}%`);
          await R.hold(page, 4);
          await R.glide(page, 330, 2400); await R.hold(page, 4); mark('23 skills after');
        }
      }
    }
    await R.hold(page, 2); mark('24 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    console.log(`\nSAVED ${saved}/${total}   BEFORE=${before}%   AFTER=${after}%`);
    await R.finish({ ctx, browser, page, outDir: OUT, name: '10-full-flow-headless-1080p', marks,
                     extra: { before, after, saved, total } });
  }
})();
