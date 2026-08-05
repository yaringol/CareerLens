/**
 * Shared helpers for recording the CareerLens app with Playwright.
 * See .claude/skills/product-screen-recording/SKILL.md for why each rule exists.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3001/api';
const APP = 'http://localhost:8080';

// injected before any page script runs: no animations, no scrollbar, no smooth-scroll fights
const CLEAN_CSS = `
  *, *::before, *::after {
    animation-duration: .001s !important;
    animation-delay: 0s !important;
    transition-duration: .001s !important;
    transition-delay: 0s !important;
  }
  html { scrollbar-width: none !important; scroll-behavior: auto !important; }
  body { scrollbar-width: none !important; }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
`;

async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login failed ${r.status}`);
  return (await r.json()).token;
}

/** headless, exactly 1920x1080, video size == viewport (rule 1 + 2) */
async function openRecorder({ outDir, width = 1920, height = 1080 }) {
  fs.mkdirSync(outDir, { recursive: true });
  // channel:'chrome' uses the installed Chrome, so no bundled-browser download is needed.
  // headless still captures from the rendering engine, so the frame is exactly the viewport.
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: outDir, size: { width, height } },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  await ctx.addInitScript((css) => {
    const add = () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  }, CLEAN_CSS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  return { browser, ctx, page };
}

function makeMarker() {
  const t0 = Date.now();
  const marks = [];
  const mark = (label) => {
    const t = (Date.now() - t0) / 1000;
    marks.push({ t: +t.toFixed(1), label });
    console.log(`  ${t.toFixed(1).padStart(7)}s  ${label}`);
  };
  return { mark, marks };
}

const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const urlPath  = (page) => page.evaluate(() => location.pathname);
const hold     = (page, s) => page.waitForTimeout(s * 1000);

/** rule 4 - wait for the page to actually be still */
async function settled(page, extraSpinner) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  const spinner = extraSpinner || /generating suggestion|analyzing your cv|loading\b|please wait/i;
  for (let i = 0; i < 80; i++) {
    if (!spinner.test(await bodyText(page))) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

/** rule 3 - eased, in-page scroll instead of mouse.wheel */
async function glide(page, px, ms = 2500) {
  await page.evaluate(([px, ms]) => new Promise((res) => {
    const start = window.scrollY;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    (function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, start + px * ease(t));
      if (t < 1) requestAnimationFrame(step); else res();
    })(performance.now());
  }), [px, ms]);
}

async function scrollTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function click(page, locator, label) {
  try {
    await locator.waitFor({ state: 'attached', timeout: 8000 });
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await page.waitForTimeout(700);
    try { await locator.click({ timeout: 6000 }); }
    catch { await locator.click({ force: true }); }
    return true;
  } catch {
    console.log(`     (skip: ${label})`);
    return false;
  }
}

/** rule 5 - confirm the mutation landed */
async function expectText(page, rx, seconds = 20) {
  for (let i = 0; i < seconds * 2; i++) {
    if (rx.test(await bodyText(page))) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function waitDashboard(page, seconds = 150) {
  for (let i = 0; i < seconds; i++) {
    if ((await urlPath(page)) === '/dashboard' && /match score/i.test(await bodyText(page))) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

const scoreOf = async (page) => {
  const m = (await bodyText(page)).match(/MATCH SCORE\s*(\d+)\s*%/i);
  return m ? m[1] : '?';
};

/**
 * Pick a level per skill honestly, never a blanket "Expert".
 *
 * A 0/10 score means "not found in the CV" - NOT "the candidate does not know it".
 * Those are different claims and only a human knows which applies, so:
 *   - `notMine`  : skills the candidate genuinely does not have -> "No knowledge"
 *                  (this is also what puts the product's own warning on camera)
 *   - any other 0: known but simply not written down yet -> "Proficient", so the
 *                  rewrite can surface it
 *   - 1-4        -> Intermediate,  5+ -> Expert
 *
 * Claiming Expert on everything once wrote Angular expertise into a React developer's
 * CV. Mapping every 0 to "No knowledge" made her disclaim git. Both are wrong; this is
 * the middle.
 */
async function pickHonestLevels(page, { notMine = [], allExpert = false, log = console.log } = {}) {
  const deny = notMine.map((s) => s.toLowerCase());
  const rows = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button').forEach((b) => {
      if (!/^(No knowledge|Beginner|Intermediate|Proficient|Expert)$/i.test(b.innerText.trim())) return;
      let el = b.parentElement, card = null;
      while (el && !card) {
        if (el.innerText && /\b\d+\s*\/\s*10\b/.test(el.innerText)) card = el;
        el = el.parentElement;
      }
      if (!card) return;
      const m = card.innerText.match(/(\d+)\s*\/\s*10/);
      const name = card.innerText.split('\n')[0].trim();
      out.push({ name, score: m ? +m[1] : null, label: b.innerText.trim() });
    });
    return out;
  });

  const byName = new Map();
  rows.forEach((r) => { if (!byName.has(r.name)) byName.set(r.name, r.score); });

  const chosen = [];
  for (const [name, score] of byName) {
    const isDenied = deny.some((d) => name.toLowerCase().includes(d));
    // allExpert: use when every listed skill is genuinely the candidate's and the CV
    // merely words it badly - the case the product exists for.
    // Safety net: a 0/10 skill has NO evidence in the CV. Claiming Expert on it is
    // fabrication (this is how `angular` and `C# programming` slipped in twice), so a
    // zero always overrides allExpert.
    const want = isDenied || score === 0 ? 'No knowledge'
               : allExpert ? 'Expert'
               : score === 0 ? 'Proficient'      // known, just not written down yet
               : score <= 4 ? 'Intermediate'
               : 'Expert';
    const btn = page.getByRole('button', { name: new RegExp(`^${want}$`, 'i') });
    // click the one inside this skill's card
    const idx = await page.evaluate(([name, want]) => {
      const all = [...document.querySelectorAll('button')]
        .filter((b) => b.innerText.trim().toLowerCase() === want.toLowerCase());
      return all.findIndex((b) => {
        let el = b.parentElement;
        while (el) {
          if (el.innerText && el.innerText.split('\n')[0].trim() === name) return true;
          if (el.querySelectorAll('button').length > 40) return false;
          el = el.parentElement;
        }
        return false;
      });
    }, [name, want]);
    if (idx >= 0) {
      await btn.nth(idx).evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
      await page.waitForTimeout(700);
      await btn.nth(idx).click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
      chosen.push(`${name} (${score}/10) -> ${want}`);
      log(`     ${name} ${score}/10 -> ${want}`);
    }
  }
  return chosen;
}

async function finish({ ctx, browser, page, outDir, name, marks, extra = {} }) {
  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video.path();
  const dest = path.join(outDir, `${name}.webm`);
  fs.renameSync(src, dest);
  fs.writeFileSync(path.join(outDir, `${name}.cut-sheet.json`),
    JSON.stringify({ ...extra, marks }, null, 2));
  console.log(`\nvideo:     ${dest}`);
  console.log(`cut sheet: ${dest.replace(/\.webm$/, '.cut-sheet.json')}`);
  return dest;
}

module.exports = {
  API, APP, login, openRecorder, makeMarker, bodyText, urlPath, hold,
  settled, glide, scrollTop, click, expectText, waitDashboard, scoreOf, pickHonestLevels, finish,
};
