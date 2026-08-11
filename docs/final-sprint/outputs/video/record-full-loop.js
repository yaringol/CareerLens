async (page) => {
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMGEyM2Q2ZDg5ZmFjMDU4ZThjYzgxZCIsImVtYWlsIjoibWF5QGNhcmVlcmxlbnMuZGV2Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzg1NzU4MDMyLCJleHAiOjE3ODYzNjI4MzJ9.xkmxH5jUbB1BSwRTvye9-ovL21r4mHsYugbJGeN3AxI';
const CV_WEAK = 'c:\\Git\\CareerLens\\test-fixtures\\authentic-cvs\\pdfs\\support-to-devops-junior-careerchange_Eli-Mizrahi.pdf';
const OUT = 'c:\\Git\\CareerLens\\docs\\final-sprint\\outputs\\video';
const STAR_FILE = 'devops-improve-demo_Tal-Bar-On.pdf';

// Order matters here. Personalizing BEFORE the improve step re-ranks the core skills
// and pushed kubernetes out of the five weakest, which killed the one shot worth
// filming. So: analyze normally -> improve -> export -> re-analyze -> and only then
// personalize, which is also where the starred-CV comparison lands its biggest gap.

const JD = `We are hiring a DevOps Engineer to join our platform team.

Requirements:
- Kubernetes and container orchestration in production
- Docker and image build pipelines
- Terraform and infrastructure as code
- CI/CD pipeline design and ownership (Jenkins, GitHub Actions)
- AWS (EC2, IAM, S3, RDS)
- Linux administration at scale
- Monitoring and alerting, incident response and on-call ownership
- Configuration management with Ansible
- Strong scripting in Bash and Python`;

  const ctx = await page.context().browser().newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  await ctx.addInitScript((t) => localStorage.setItem('auth_token', t), TOKEN);
  const p = await ctx.newPage();

  const log = [];
  const step = async (name, ms) => { log.push(name); await p.waitForTimeout(ms); };
  const settled = (t = 90000) =>
    p.waitForFunction(() => !document.querySelector('.improve-suggestion-loading'), null, { timeout: t }).catch(() => {});
  const dashReady = (t = 180000) =>
    p.waitForFunction(() => /MATCH SCORE/i.test(document.body.innerText), null, { timeout: t });
  const readBanner = () => p.evaluate(() => {
    const b = document.querySelector('.saved-cv-banner');
    return b ? b.innerText.replace(/\n+/g, ' | ') : null;
  });
  const readScore = () => p.evaluate(() => document.querySelector('.gauge-value, .half-circle-value')?.textContent
    ?? (document.body.innerText.match(/MATCH SCORE\s+(\d+)/i) ?? [])[1] ?? '?');
  const holdBanner = async (ms) => {
    await p.evaluate(() => document.querySelector('.saved-cv-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await step('banner held', ms);
  };

  try {
    // ═══ ACT 1 — the library ═════════════════════════════════════════
    await p.goto('http://localhost:8080/');
    await step('landing', 3000);
    await p.evaluate(() => document.querySelector('main')?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    await step('scroll to form', 2500);

    await p.evaluate(() => [...document.querySelectorAll('.cv-tab')].find((b) => b.textContent.includes('My CVs'))?.click());
    await p.waitForSelector('.saved-cv-item', { timeout: 20000 });
    await step('library open', 3500);

    // The star stops propagation, so this does not also select the CV.
    log.push(`star: ${await p.evaluate((name) => {
      const row = [...document.querySelectorAll('.saved-cv-item')]
        .find((li) => li.querySelector('.saved-cv-name')?.textContent.includes(name));
      const s = row?.querySelector('.cv-favorite-star');
      if (!s) return 'not found';
      s.click();
      return 'clicked';
    }, STAR_FILE)}`);
    await step('starred', 3500);
    log.push(`star state: ${JSON.stringify(await p.evaluate((name) => {
      const row = [...document.querySelectorAll('.saved-cv-item')]
        .find((li) => li.querySelector('.saved-cv-name')?.textContent.includes(name));
      const s = row?.querySelector('.cv-favorite-star');
      return { active: s?.className.includes('--active'), pressed: s?.getAttribute('aria-pressed') };
    }, STAR_FILE))}`);

    // ═══ ACT 2 — the weak CV, standard analysis ══════════════════════
    await p.evaluate(() => [...document.querySelectorAll('.cv-tab')].find((b) => b.textContent.includes('Upload New CV'))?.click());
    await step('back to upload tab', 2000);

    await p.setInputFiles('input[type=file].file-input-hidden', CV_WEAK);
    await p.waitForFunction(() => document.body.innerText.includes('Detected role'), null, { timeout: 60000 });
    await step('role detected', 4500);

    await p.click('textarea.field-textarea');
    await p.type('textarea.field-textarea', JD.slice(0, 58), { delay: 20 });
    await p.evaluate((jd) => {
      const ta = document.querySelector('textarea.field-textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, jd);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, JD);
    await step('jd pasted', 2500);

    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Analyze Match')?.click());
    await p.waitForURL('**/dashboard', { timeout: 180000 });
    await dashReady();
    await step('dashboard', 5000);
    log.push(`SCORE (standard): ${await readScore()}%`);
    const banner1 = await readBanner();
    log.push(`BANNER 1: ${banner1 ?? 'NOT RENDERED'}`);
    if (banner1) await holdBanner(5000);

    await p.mouse.wheel(0, 380); await step('core skills', 3500);
    await p.mouse.wheel(0, 380); await step('dynamic skills', 3000);

    const gap = await p.$('.gap-toggle');
    if (gap) {
      await gap.click(); await step('gap expanded', 4500);
      await p.mouse.wheel(0, 380); await step('gap scroll', 3000);
      await gap.click(); await step('gap collapsed', 1500);
    }

    // ═══ ACT 3 — improve, export ═════════════════════════════════════
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await step('to CTA', 1800);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Improve your CV'))?.click());
    await p.waitForURL('**/improve', { timeout: 30000 });
    await p.waitForSelector('.improve-skill-card', { timeout: 120000 });
    await step('proficiency', 3500);

    const levels = ['Beginner', 'Beginner', 'Intermediate', 'Intermediate', 'Proficient'];
    const cards = await p.$$('.improve-skill-card');
    for (let i = 0; i < cards.length; i++) {
      await cards[i].evaluate((card, w) => {
        [...card.querySelectorAll('.improve-prof-btn')].find((x) => x.textContent.trim() === w)?.click();
      }, levels[i] ?? 'Intermediate');
      await p.waitForTimeout(950);
    }
    await step('rated', 2500);
    await p.click('.improve-continue-btn');
    await p.waitForSelector('.improve-tabs', { timeout: 30000 });
    log.push(`tabs: ${(await p.$$eval('.improve-tab', (t) => t.map((x) => x.textContent.trim()))).join(' | ')}`);

    // Survey every tab, then hold on whichever points at the rarest section - the
    // skill set is the model's call, so never hard-code a tab name.
    const tabCount = await p.$$eval('.improve-tab', (t) => t.length);
    const seen = [];
    for (let i = 0; i < tabCount; i++) {
      await p.evaluate((idx) => document.querySelectorAll('.improve-tab')[idx]?.click(), i);
      await p.waitForFunction(() => {
        const loading = document.querySelector('.improve-suggestion-loading');
        return !loading && !!document.querySelector('.improve-new-text, .improve-notice--warn, .improve-suggestion-failed');
      }, null, { timeout: 120000 }).catch(() => {});
      const info = await p.evaluate(() => ({
        name: document.querySelector('.improve-tab--active')?.textContent.trim(),
        section: document.querySelector('.improve-section-chip')?.textContent ?? '-',
        mentions: document.querySelectorAll('.improve-occ-tab').length,
      }));
      seen.push({ idx: i, ...info });
      log.push(`tab[${i}] ${info.name} -> "${info.section}" mentions=${info.mentions}`);
      await step(`survey ${info.name}`, 4500);

      // Accept the suggestion. Submit does NOT require Save - an unsaved suggestion
      // is silently dropped from the merged CV, which is why an earlier take came
      // back from re-analysis with a LOWER score: only one edit had ever landed.
      const saved = await p.evaluate(() => {
        const b = document.querySelector('.improve-done-btn:not([disabled])');
        if (!b) return 'none';
        b.click();
        return 'saved';
      });
      log.push(`   accept ${info.name}: ${saved}`);
      await settled();
      await step(`accepted ${info.name}`, 2200);
    }

    const freq = seen.reduce((m, s) => ({ ...m, [s.section]: (m[s.section] ?? 0) + 1 }), {});
    const best = [...seen].sort((a, b) => (freq[a.section] - freq[b.section]) || (b.mentions - a.mentions))[0];
    log.push(`HERO TAB: ${best?.name} -> "${best?.section}" (${freq[best?.section]} of ${seen.length} tabs use it)`);
    if (best) {
      await p.evaluate((idx) => document.querySelectorAll('.improve-tab')[idx]?.click(), best.idx);
      await settled();
      await step(`hero ${best.name}`, 9000);
      const occ = await p.$$('.improve-occ-tab');
      if (occ.length > 1) { await occ[1].click(); await settled(); await step('mention 2', 6000); }
    }

    const editBtn = await p.$('.improve-edit-btn');
    if (editBtn) {
      await editBtn.click(); await step('editing', 1500);
      await p.click('.improve-edit-textarea');
      await p.keyboard.press('End');
      await p.type('.improve-edit-textarea', ' Maintained the shared runner images.', { delay: 32 });
      await step('typed', 2000);
      const save = await p.$('.improve-done-btn');
      if (save) { await save.click(); await step('saved edit', 3000); }
    }

    await p.evaluate(() => { const t = document.querySelectorAll('.improve-tab'); t[t.length - 1]?.click(); });
    await settled(); await step('last tab', 2500);
    for (let i = 0; i < 8; i++) {
      const tabs = await p.$$('.improve-occ-tab');
      if (tabs.length < 2) break;
      const active = await p.$$eval('.improve-occ-tab', (ts) => ts.findIndex((t) => t.className.includes('--active')));
      if (active === tabs.length - 1) break;
      await tabs[tabs.length - 1].click(); await settled(); await step('last mention', 2500);
    }

    const submit = await p.$('.improve-submit-btn:not([disabled])');
    if (submit) {
      await submit.click();
      await p.waitForSelector('.improve-cv-text', { timeout: 150000 }).catch(() => {});
      await step('merged CV', 6000);
      await p.mouse.wheel(0, 420); await step('read merged', 4000);
    } else { log.push('SUBMIT NOT AVAILABLE'); }

    if (await p.evaluate(() => {
      const b = [...document.querySelectorAll('.improve-action-btn')].find((x) => x.textContent.trim() === 'Export');
      if (b) b.id = 'export-target';
      return !!b;
    })) {
      const [dl] = await Promise.all([
        p.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        p.click('#export-target'),
      ]);
      if (dl) { await dl.saveAs(`${OUT}\\exported-cv-eli-mizrahi.txt`); log.push(`DOWNLOAD: ${dl.suggestedFilename()}`); }
      else log.push('DOWNLOAD: no event');
      await step('exported', 4000);
    }

    // ═══ ACT 4 — re-analyze; the score should move ═══════════════════
    await p.evaluate(() => [...document.querySelectorAll('.improve-action-btn')].find((x) => x.textContent.includes('Re-analyze'))?.click());
    await step('reanalyze overlay', 3500);
    await p.waitForURL('**/dashboard', { timeout: 180000 });
    await dashReady();
    await step('rescored', 6000);
    log.push(`SCORE (after improve): ${await readScore()}%`);
    log.push(`BANNER 2: ${(await readBanner()) ?? 'NOT RENDERED'}`);

    // ═══ ACT 5 — retune, then the payoff ════════════════════════════
    const hasPersonalize = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Personalize'));
      if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); b.id = 'personalize-target'; }
      return !!b;
    });
    log.push(`dashboard Personalize button: ${hasPersonalize}`);

    if (hasPersonalize) {
      await step('found personalize', 2500);
      await p.click('#personalize-target');
      await p.waitForURL('**/personalize', { timeout: 30000 });
      await p.waitForSelector('.preset-btn', { timeout: 30000 });
      await step('personalize open', 3500);

      const preset = async (name, dwell) => {
        await p.evaluate((n) => [...document.querySelectorAll('.preset-btn')].find((b) => b.textContent.trim() === n)?.click(), name);
        await step(`preset ${name}`, dwell);
      };
      await preset('Stable', 3000);
      await preset('Trending', 3000);
      await preset('Custom', 2500);

      const sliders = await p.$$('input.pref-slider');
      log.push(`sliders: ${sliders.length}`);
      if (sliders.length >= 2) {
        await sliders[1].focus();
        for (let i = 0; i < 14; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(110); }
        await step('trending raised', 3000);
      }
      log.push(`weights: ${(await p.$$eval('.weight-value', (e) => e.map((x) => x.textContent))).join(' / ')}`);

      const chips = await p.$$('.focus-skill-chip');
      log.push(`chips: ${chips.length}`);
      if (chips.length) {
        await p.evaluate(() => [...document.querySelectorAll('.focus-skill-chip')].find((c) => c.getAttribute('aria-pressed') === 'false')?.click());
        await step('6th chip -> toast', 4000);
        await p.evaluate(() => [...document.querySelectorAll('.focus-skill-chip')].filter((c) => c.getAttribute('aria-pressed') === 'true').pop()?.click());
        await step('deselect one', 2200);
        await p.evaluate(() => [...document.querySelectorAll('.focus-skill-chip')].find((c) => c.getAttribute('aria-pressed') === 'false')?.click());
        await step('select another', 3000);
      }

      await p.evaluate(() => document.querySelector('.save-toggle input[type=checkbox]')?.click());
      await step('remember balance', 2500);

      await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Analyze with preferences'))?.click());
      await p.waitForURL('**/dashboard', { timeout: 180000 });
      await dashReady();
      await step('personalized dashboard', 6000);
      log.push(`SCORE (personalized): ${await readScore()}%`);
    } else {
      log.push('SKIPPED personalize - button not on the dashboard');
    }

    const banner3 = await readBanner();
    log.push(`BANNER 3 (payoff): ${banner3 ?? 'NOT RENDERED'}`);
    if (banner3) {
      await holdBanner(6000);
      await p.click('.saved-cv-banner__btn');
      await p.waitForTimeout(2500);
      log.push(`AFTER SWITCH: ${await p.evaluate(() => document.body.innerText.slice(0, 320).replace(/\n+/g, ' | '))}`);
      await step('tal analysis', 8000);
      await p.mouse.wheel(0, 380); await step('tal skills', 5000);
    } else {
      log.push('FALLBACK: no banner - reaching Tal through the library');
      await p.goto('http://localhost:8080/');
      await p.evaluate(() => document.querySelector('main')?.scrollIntoView({ block: 'end' }));
      await p.evaluate(() => [...document.querySelectorAll('.cv-tab')].find((b) => b.textContent.includes('My CVs'))?.click());
      await p.waitForSelector('.saved-cv-item', { timeout: 20000 });
      await step('library', 3000);
      await p.evaluate((name) => [...document.querySelectorAll('.saved-cv-item')]
        .find((li) => li.querySelector('.saved-cv-name')?.textContent.includes(name))?.click(), STAR_FILE);
      await step('tal selected', 4000);
    }

    log.push('DONE');
  } catch (err) {
    log.push(`ERROR: ${err.message}`);
  }

  const video = p.video();
  const tmp = video ? await video.path() : null;
  await ctx.close();
  return { log, video: tmp };
}
