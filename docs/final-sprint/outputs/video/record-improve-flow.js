async (page) => {
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMGEyM2Q2ZDg5ZmFjMDU4ZThjYzgxZCIsImVtYWlsIjoibWF5QGNhcmVlcmxlbnMuZGV2Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzg1NzU4MDMyLCJleHAiOjE3ODYzNjI4MzJ9.xkmxH5jUbB1BSwRTvye9-ovL21r4mHsYugbJGeN3AxI';
const CV = 'c:\\Git\\CareerLens\\test-fixtures\\improve-demo\\pdfs\\devops-improve-demo_Tal-Bar-On.pdf';
const OUT = 'c:\\Git\\CareerLens\\docs\\final-sprint\\outputs\\video';

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


  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  await ctx.addInitScript((t) => localStorage.setItem('auth_token', t), TOKEN);
  const p = await ctx.newPage();
  const log = [];
  const step = async (name, ms) => { log.push(name); await p.waitForTimeout(ms); };

  try {
    // ── 1. Landing ──────────────────────────────────────────────────────
    await p.goto('http://localhost:8080/');
    await step('landing', 3000);
    await p.evaluate(() => document.querySelector('.upload-card, form, main')?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    await step('scroll to form', 2500);

    // ── 2. Upload the CV ────────────────────────────────────────────────
    await p.setInputFiles('input[type=file].file-input-hidden', CV);
    await p.waitForFunction(() => document.body.innerText.includes('Detected role'), null, { timeout: 60000 });
    await step('detected role visible', 4000);

    // ── 3. Job description ──────────────────────────────────────────────
    await p.fill('textarea.field-textarea', '');
    await p.type('textarea.field-textarea', JD.slice(0, 60), { delay: 18 });
    await p.evaluate((jd) => {
      const ta = document.querySelector('textarea.field-textarea');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(ta, jd);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, JD);
    await step('jd pasted', 2500);

    // ── 4. Analyze ──────────────────────────────────────────────────────
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Analyze Match').click());
    await p.waitForURL('**/dashboard', { timeout: 120000 });
    await p.waitForFunction(() => document.body.innerText.includes('MATCH SCORE') || document.body.innerText.includes('Match Score'), null, { timeout: 120000 });
    await step('dashboard rendered', 5000);

    // Scroll through the score and the skills
    await p.mouse.wheel(0, 400); await step('scroll skills', 3000);
    await p.mouse.wheel(0, 400); await step('scroll skills 2', 3000);

    // Gap analysis - expand, read, collapse
    const gap = await p.$('.gap-toggle');
    if (gap) {
      await gap.click();
      await step('gap expanded', 4500);
      await p.mouse.wheel(0, 400); await step('gap scroll', 3000);
      await gap.click(); await step('gap collapsed', 1500);
    }
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await step('scroll to CTA', 2000);

    // ── 5. Improve ──────────────────────────────────────────────────────
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Improve your CV')).click());
    await p.waitForURL('**/improve', { timeout: 30000 });
    await p.waitForSelector('.improve-skill-card', { timeout: 90000 });
    await step('proficiency screen', 3500);

    // Rate each skill, one at a time so the choice is visible
    const levels = ['Beginner', 'Beginner', 'Intermediate', 'Intermediate', 'Proficient'];
    const cards = await p.$$('.improve-skill-card');
    for (let i = 0; i < cards.length; i++) {
      const want = levels[i] ?? 'Intermediate';
      await cards[i].evaluate((card, w) => {
        const b = [...card.querySelectorAll('.improve-prof-btn')].find((x) => x.textContent.trim() === w);
        b && b.click();
      }, want);
      await p.waitForTimeout(900);
    }
    await step('all rated', 2500);

    await p.click('.improve-continue-btn');
    await p.waitForSelector('.improve-tabs', { timeout: 30000 });
    await step('improvement phase', 2000);

    // ── 6. Walk the tabs - one per UI branch ────────────────────────────
    const tabNames = await p.$$eval('.improve-tab', (ts) => ts.map((t) => t.textContent.trim()));
    log.push(`tabs: ${tabNames.join(' | ')}`);

    const visit = async (needle, dwell) => {
      await p.evaluate((n) => {
        const t = [...document.querySelectorAll('.improve-tab')].find((x) => x.textContent.toLowerCase().includes(n));
        t && t.click();
      }, needle.toLowerCase());
      // wait for a suggestion (or the failure/notice state) to settle
      await p.waitForFunction(() => {
        const loading = document.querySelector('.improve-suggestion-loading');
        const has = document.querySelector('.improve-new-text, .improve-notice--warn, .improve-suggestion-failed');
        return !loading && !!has;
      }, null, { timeout: 90000 }).catch(() => {});
      await step(`tab ${needle}`, dwell);
    };

    // terraform - absent skill -> "Target section" panel
    await visit('terraform', 7000);
    // kubernetes - single mention, lands in PROFESSIONAL EXPERIENCE (different section!)
    await visit('kubernetes', 8000);
    // python - 4 mentions -> occurrence tabs + shared-section notice
    await visit('python', 7000);

    const occ = await p.$$('.improve-occ-tab');
    if (occ.length > 1) {
      await occ[1].click();
      await p.waitForFunction(() => !document.querySelector('.improve-suggestion-loading'), null, { timeout: 90000 }).catch(() => {});
      await step('mention 2', 6000);
    }

    // Save this one so the merged CV has a real change in it
    const save = await p.$('.improve-done-btn:not([disabled])');
    if (save) { await save.click(); await step('saved', 3000); }

    // ── 7. Submit and show the merged CV ────────────────────────────────
    await p.evaluate(() => {
      const t = document.querySelectorAll('.improve-tab');
      t[t.length - 1] && t[t.length - 1].click();
    });
    await p.waitForFunction(() => !document.querySelector('.improve-suggestion-loading'), null, { timeout: 90000 }).catch(() => {});
    await step('last tab', 2500);

    // Submit only renders at the last skill's LAST occurrence - walk there.
    for (let i = 0; i < 8; i++) {
      const last = await p.$$('.improve-occ-tab');
      if (last.length < 2) break;
      const activeIdx = await p.$$eval('.improve-occ-tab', (ts) => ts.findIndex((t) => t.className.includes('--active')));
      if (activeIdx === last.length - 1) break;
      await last[last.length - 1].click();
      await p.waitForFunction(() => !document.querySelector('.improve-suggestion-loading'), null, { timeout: 90000 }).catch(() => {});
      await step('last mention', 3000);
    }

    const submit = await p.$('.improve-submit-btn:not([disabled])');
    if (submit) {
      await submit.click();
      await p.waitForSelector('.improve-cv-text', { timeout: 120000 }).catch(() => {});
      await step('merged CV', 6000);
      await p.mouse.wheel(0, 500); await step('read merged CV', 5000);
    } else {
      log.push('SUBMIT NOT AVAILABLE');
    }

    log.push('DONE');
  } catch (err) {
    log.push(`ERROR: ${err.message}`);
  }

  const video = p.video();
  const tmpPath = video ? await video.path() : null;
  await ctx.close();          // flushes the video file
  return { log, video: tmpPath };
}
