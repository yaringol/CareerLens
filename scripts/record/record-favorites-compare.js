/**
 * Favourites: star a CV in the library, then upload a weaker one for the same role.
 * The starred CV wins and the dashboard offers "Switch to this CV".
 * Rules: .claude/skills/product-screen-recording/SKILL.md
 *
 *   node scripts/record/record-favorites-compare.js
 */
const fs = require('fs');
const path = require('path');
const R = require('./recorder');

const OUT    = path.resolve(__dirname, '../../docs/final-sprint/promo/clips/product/walkthrough');
const WEAK   = path.resolve(__dirname, '../../test-fixtures/authentic-cvs/pdfs/bootcamp-frontend-junior-weak_Sapir-Ohana.pdf');
const JD     = path.resolve(__dirname, 'jd-frontend.txt');
const STRONG = 'frontend-mid-strong_Noa-Shapiro.pdf';   // the one we star
const EMAIL  = process.env.REC_EMAIL || 'demo@careerlens.dev';
const PW     = process.env.REC_PASSWORD || 'DemoRecord!2026';

(async () => {
  const token = await R.login(EMAIL, PW);
  const { browser, ctx, page } = await R.openRecorder({ outDir: OUT });
  const { mark, marks } = R.makeMarker();
  let banner = false, scores = '';

  try {
    await page.goto(R.APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    await page.goto(R.APP, { waitUntil: 'networkidle' });
    await R.settled(page);
    await R.hold(page, 1.5);

    // ---- 1. star the strong CV in the library ----
    if (!(await R.click(page, page.getByRole('link', { name: /account/i }).first(), 'Account'))) {
      await R.click(page, page.getByRole('button', { name: /my account/i }).first(), 'My Account');
    }
    await R.settled(page);
    await R.hold(page, 3.5); mark('01 CV library');

    // find which star belongs to the strong CV's row
    // walk up only while the ancestor still holds exactly ONE star, i.e. is still this row
    const idx = await page.evaluate((name) => {
      const stars = [...document.querySelectorAll('.cv-favorite-star')];
      return stars.findIndex((s) => {
        let el = s.parentElement;
        while (el && el.querySelectorAll('.cv-favorite-star').length === 1) {
          if (el.textContent.includes(name)) return true;
          el = el.parentElement;
        }
        return false;
      });
    }, STRONG);
    if (idx >= 0) {
      const star = page.locator('.cv-favorite-star').nth(idx);
      await star.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
      await R.hold(page, 1.8);
      await star.click({ force: true }).catch(() => {});
      await R.expectText(page, /remove from favorites/i, 8);
      await R.hold(page, 3); mark(`02 STARRED ${STRONG}`);
    } else {
      console.log('     !! no star row matched', STRONG);
    }
    await R.hold(page, 2);

    // ---- 2. upload a weaker CV for the same role ----
    await R.click(page, page.getByRole('link', { name: /^home$/i }).first(), 'Home');
    await R.settled(page);
    await R.click(page, page.getByRole('button', { name: /start analyzing/i }).first(), 'Start');
    await R.settled(page);
    await R.hold(page, 2); mark('03 upload screen');

    // don't add another copy to the library while recording
    const saveToggle = page.locator('input[type="checkbox"]').first();
    if (await saveToggle.count()) await saveToggle.uncheck({ force: true }).catch(() => {});

    await page.locator('input[type="file"]').first().setInputFiles(WEAK);
    await R.expectText(page, /detected role/i, 30);
    await R.settled(page);
    await R.hold(page, 3.5); mark('04 weaker CV uploaded');

    const ta = page.locator('textarea').first();
    await ta.click();
    await ta.fill(fs.readFileSync(JD, 'utf8'));
    await R.hold(page, 2.5); mark('05 same job posting');

    mark('06 CUT_START analysing');
    let ok = false;
    for (let a = 1; a <= 3 && !ok; a++) {
      await R.click(page, page.getByRole('button', { name: /analy[sz]e match/i }).first(), 'Analyze Match');
      ok = await R.waitDashboard(page);
    }
    if (!ok) throw new Error('dashboard never rendered');
    await R.settled(page);
    await R.scrollTop(page);
    mark('07 CUT_END dashboard');
    await R.hold(page, 4);

    // ---- 3. the banner ----
    banner = await R.expectText(page, /better match in your library/i, 15);
    if (banner) {
      const t = await R.bodyText(page);
      const m = t.match(/Better match in your library\s*(.{0,120})/i);
      scores = m ? m[1].trim() : '';
      console.log('     banner:', scores);
      mark('08 BANNER "Better match in your library"');
      await R.hold(page, 6);
    } else {
      console.log('     !! banner did not appear - the starred CV did not beat the uploaded one');
    }

    // ---- 4. switch ----
    if (await R.click(page, page.getByRole('button', { name: /switch to this cv/i }).first(), 'Switch to this CV')) {
      await R.settled(page);
      await R.hold(page, 5); mark('09 SWITCHED to the starred CV');
      await R.glide(page, 320, 2400);
      await R.hold(page, 4); mark('10 skills of the switched CV');
    }
    await R.hold(page, 2); mark('11 END');
  } catch (e) {
    console.error('  ERROR:', e.message);
  } finally {
    console.log(`\nbanner shown: ${banner}   ${scores}`);
    await R.finish({ ctx, browser, page, outDir: OUT, name: '13-favorites-compare-and-switch', marks,
                     extra: { banner, scores } });
  }
})();
