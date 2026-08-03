"""Step 15: build the blind precision@10 sheet for model 1 (skill ranking).

Scope decision (user, 2026-08-02): the 12 canonical titles that actually carry
real data. The other 47 have zero records in the current artefact and are
reported as a coverage limitation instead of being measured on empty input.

Blinding: the live model and the pre-M06 backup are read offline and their
top-10 lists are MERGED into one shuffled, unlabelled list per title. The rater
marks each skill relevant / not relevant for the role without knowing which
model proposed it (or that two models exist). precision@10 is then computed per
model from the key file.

Both artefacts are read directly with joblib - MODEL_PATH is never repointed and
the running server is never touched, so no restart and no risk of leaving the
demo box on the wrong model.

Usage: python scripts/eval/14_build_precision_sheet.py
"""
import html
import json
import os
import sys

import joblib

DS_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ds', 'model'))
sys.path.insert(0, DS_DIR)

from skill_schema import compute_role_counts, select_display_skills  # noqa: E402

OUT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..',
    'docs', 'final-sprint', 'outputs', 'metrics-raw'
))

LIVE = os.path.join(DS_DIR, 'model.joblib')
BACKUP = os.path.join(DS_DIR, 'model.joblib.bak-20260728')

# Serving configuration in force for the live model (see official-metrics.md §0).
UBIQUITY_CAP = int(os.getenv('SKILL_UBIQUITY_CAP', '11'))
MIN_PREVALENCE = float(os.getenv('ROLE_COUNT_MIN_PREVALENCE', '0.05'))
TOP_N = 10

# Deterministic shuffle so the sheet can be regenerated without reordering.
_seed = 20260802


def rand():
    global _seed
    _seed = (_seed * 1103515245 + 12345) % 2147483648
    return _seed / 2147483648


def shuffle(items):
    a = list(items)
    for i in range(len(a) - 1, 0, -1):
        j = int(rand() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


def top_skills(model, title, cap, min_prev):
    fm = model.get('feature_matrix') or {}
    if title not in fm:
        return []
    role_counts = compute_role_counts(fm, min_prevalence=min_prev)
    picked = select_display_skills(
        fm[title], pool_size=TOP_N, display_count=TOP_N,
        role_counts=role_counts, ubiquity_cap=cap,
    )
    return [p['skill'] for p in picked]


def main():
    live = joblib.load(LIVE)
    backup = joblib.load(BACKUP) if os.path.exists(BACKUP) else None
    if backup is None:
        print(f"[warn] backup artefact missing at {BACKUP} - sheet will cover the live model only")

    titles = sorted(t for t, rows in (live.get('feature_matrix') or {}).items() if rows)
    print(f"titles with real data in the live artefact: {len(titles)}")

    entries = []
    for title in titles:
        live_skills = top_skills(live, title, UBIQUITY_CAP, MIN_PREVALENCE)
        # The backup predates the ubiquity filter, so it is read the way it was
        # actually served then: prevalence-only, no filter.
        back_skills = top_skills(backup, title, 10 ** 6, 0.0) if backup else []
        merged = shuffle(sorted(set(live_skills) | set(back_skills)))
        entries.append({
            'title': title,
            'live_top10': live_skills,
            'backup_top10': back_skills,
            'merged': merged,
        })

    key_path = os.path.join(OUT_DIR, '14-precision-key.json')
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(key_path, 'w', encoding='utf-8') as fh:
        json.dump({
            'config': {'ubiquity_cap': UBIQUITY_CAP, 'min_prevalence': MIN_PREVALENCE, 'top_n': TOP_N},
            'live_artifact': os.path.basename(LIVE),
            'backup_artifact': os.path.basename(BACKUP) if backup else None,
            'entries': entries,
        }, fh, indent=2)

    total = sum(len(e['merged']) for e in entries)
    sections = []
    for i, e in enumerate(entries):
        rows = '\n'.join(
            f'''      <tr>
        <td class="skill">{html.escape(s)}</td>
        <td><label><input type="radio" name="r-{i}-{j}" value="yes" data-title="{html.escape(e['title'])}" data-skill="{html.escape(s)}"> relevant</label></td>
        <td><label><input type="radio" name="r-{i}-{j}" value="no" data-title="{html.escape(e['title'])}" data-skill="{html.escape(s)}"> not relevant</label></td>
      </tr>'''
            for j, s in enumerate(e['merged'])
        )
        sections.append(f'''
<section class="item">
  <header><span class="counter">{i + 1} / {len(entries)}</span><h2>{html.escape(e['title'])}</h2></header>
  <p class="q">Would you expect a hiring manager to list this skill for a <strong>{html.escape(e['title'])}</strong> role?</p>
  <table class="skills"><tbody>
{rows}
  </tbody></table>
</section>''')

    sheet = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>M05 — model 1 relevance annotation</title>
<style>
  :root {{ --line:#d8d8e4; --ink:#1b1b28; --muted:#5c5c74; --accent:#4b3fd4; }}
  body {{ font:15px/1.55 -apple-system, Segoe UI, Roboto, sans-serif; color:var(--ink);
         max-width:900px; margin:0 auto; padding:24px; background:#fbfbfe; }}
  .intro {{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px 20px; margin-bottom:24px; }}
  .item {{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:18px 20px; margin-bottom:22px; }}
  .item header {{ display:flex; align-items:baseline; gap:12px; border-bottom:1px solid var(--line); padding-bottom:8px; }}
  .item h2 {{ font-size:17px; margin:0; }}
  .counter {{ color:var(--muted); font-size:13px; }}
  .q {{ color:var(--muted); font-size:13px; }}
  table.skills {{ width:100%; border-collapse:collapse; }}
  table.skills td {{ border-bottom:1px solid #eee; padding:7px 4px; }}
  td.skill {{ font-weight:600; width:50%; }}
  label {{ font-size:13px; color:var(--muted); cursor:pointer; }}
  #bar {{ position:sticky; top:0; background:#fbfbfe; padding:10px 0; border-bottom:1px solid var(--line);
         display:flex; gap:12px; align-items:center; z-index:5; }}
  button {{ background:var(--accent); color:#fff; border:0; border-radius:6px; padding:8px 14px; font-size:14px; cursor:pointer; }}
  #progress {{ color:var(--muted); font-size:13px; }}
</style></head><body>

<div id="bar"><button id="export">Export answers (JSON)</button><span id="progress"></span></div>

<h1>Which skills belong to this role?</h1>
<div class="intro">
  <p>For each role, mark every skill <strong>relevant</strong> or <strong>not relevant</strong>
     for someone hiring that role today.</p>
  <p>The lists are merged and shuffled on purpose — judge each skill on its own merit.
     Answers save automatically; press <em>Export answers</em> when finished and save to
     <code>docs/final-sprint/outputs/metrics-raw/15-precision-labels.json</code>.</p>
</div>

{''.join(sections)}

<script>
const KEY='m05-precision-v1';
const store=JSON.parse(localStorage.getItem(KEY)||'{{}}');
const total={total};
function progress(){{
  let done=0; for(const t of Object.values(store)) done+=Object.keys(t).length;
  document.getElementById('progress').textContent=done+' / '+total+' marked';
}}
document.querySelectorAll('input[type=radio]').forEach(el=>{{
  const prev=(store[el.dataset.title]||{{}})[el.dataset.skill];
  if(prev===el.value) el.checked=true;
  el.addEventListener('change',()=>{{
    store[el.dataset.title]=store[el.dataset.title]||{{}};
    store[el.dataset.title][el.dataset.skill]=el.value;
    localStorage.setItem(KEY,JSON.stringify(store));
    progress();
  }});
}});
document.getElementById('export').addEventListener('click',()=>{{
  const blob=new Blob([JSON.stringify({{labels:store,exportedAt:new Date().toISOString()}},null,2)],{{type:'application/json'}});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='15-precision-labels.json'; a.click();
}});
progress();
</script>
</body></html>'''

    sheet_path = os.path.join(OUT_DIR, '14-precision-sheet.html')
    with open(sheet_path, 'w', encoding='utf-8') as fh:
        fh.write(sheet)

    overlap = sum(len(set(e['live_top10']) & set(e['backup_top10'])) for e in entries)
    print(f"roles in sheet : {len(entries)}")
    print(f"skills to mark : {total}  (live+backup merged, deduplicated)")
    print(f"overlap between the two models: {overlap} shared skills across all roles")
    print(f"sheet: {sheet_path}")
    print(f"key  : {key_path}")


if __name__ == '__main__':
    main()
