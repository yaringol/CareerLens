"""Step 9: build the CV x JD pair set for scoring-agent evaluation.

Job descriptions come from `careerlens.lang-uk-job-skills` (41,745 real Djinni
postings). Two properties of that corpus drive the design:

  * only 12 canonical titles are covered - exactly the 12 model 1 has real data
    for, so Parts B and C rest on the same coverage base;
  * `og_title` is a HEURISTIC label mapped from Djinni's Primary Keyword tag
    (lang_uk_mapping.py), not a human judgement. Selected postings are therefore
    written out for manual review before they are used.

Pair design - three bands, deliberately:
  matched   CV and JD share the canonical title
  adjacent  neighbouring family (Backend x Data Engineer)
  mismatched unrelated (Frontend x Cyber Security)

Without that spread every score lands at the top of the range and Spearman rho
is computed over a band too narrow to mean anything.

Read-only against Mongo. Usage:
    python scripts/eval/10_build_jd_pairs.py
"""
import json
import os
import re

from pymongo import MongoClient

OUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..',
    'docs', 'final-sprint', 'outputs', 'metrics-raw'
)
FIXTURES = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..',
    'test-fixtures', 'authentic-cvs', 'manifest.json'
)

MIN_DESC, MAX_DESC = 900, 3000

# Adjacency is asserted here rather than inferred - it encodes which pairs are
# "close but wrong", which is where a scorer should show graded behaviour.
ADJACENT = {
    'Backend Developer': 'Data Engineer',
    'Frontend Developer': 'Software Engineer',
    'DevOps Engineer': 'Backend Developer',
    'Data Scientist': 'Data Engineer',
    'Java Developer': 'Backend Developer',
    'QA Automation Engineer': 'Software Engineer',
    'Data Engineer': 'Data Scientist',
    'Software Engineer': 'Java Developer',
}
MISMATCH = {
    'Backend Developer': 'UX Designer',
    'Frontend Developer': 'Cyber Security',
    'DevOps Engineer': 'UX Designer',
    'Data Scientist': 'QA Automation Engineer',
    'Java Developer': 'UX Designer',
    'QA Automation Engineer': 'Cyber Security',
    'Data Engineer': 'Frontend Developer',
    'Software Engineer': 'UX Designer',
}


def clean(text):
    text = re.sub(r'\s+', ' ', text or '').strip()
    return text


def main():
    uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    coll = MongoClient(uri, serverSelectionTimeoutMS=8000).careerlens['lang-uk-job-skills']

    with open(FIXTURES, encoding='utf-8') as fh:
        manifest = json.load(fh)
    cvs = [c for c in manifest['cvs'] if not c['is_negative_fixture']]

    # Pool JDs for every title referenced as a source OR as a band target,
    # otherwise the mismatched band silently collapses (its targets - UX
    # Designer, Cyber Security - are not CV titles).
    titles = sorted(set(ADJACENT) | set(ADJACENT.values()) | set(MISMATCH.values()))
    jds = {}
    for title in titles:
        docs = list(coll.find(
            {'og_title': title},
            {'title': 1, 'og_title': 1, 'description': 1, 'company': 1,
             'exp_years': 1, 'datePosted': 1},
        ).limit(400))
        picked = []
        for d in docs:
            desc = clean(d.get('description'))
            if MIN_DESC <= len(desc) <= MAX_DESC:
                picked.append({
                    'jd_id': str(d.get('_id')),
                    'og_title': d.get('og_title'),
                    'posting_title': d.get('title'),
                    'company': d.get('company'),
                    'exp_years': d.get('exp_years'),
                    'description': desc,
                })
            if len(picked) == 2:
                break
        if not picked:
            print(f"[warn] no usable posting for {title}")
        jds[title] = picked

    # One CV per covered title: 8 CVs x 3 bands = 24 pairs, which is what a
    # single annotator can label attentively in one sitting (10 skills each).
    # More pairs would buy resolution the labelling budget cannot pay for.
    chosen, seen_titles = [], set()
    for cv in cvs:
        t = cv['true_title']
        if t in ADJACENT and t not in seen_titles:
            seen_titles.add(t)
            chosen.append(cv)
    cvs = chosen

    pairs = []
    for cv in cvs:
        true_title = cv['true_title']
        if true_title not in jds or not jds[true_title]:
            continue  # CV's role has no real postings in the corpus
        bands = [
            ('matched', true_title),
            ('adjacent', ADJACENT.get(true_title)),
            ('mismatched', MISMATCH.get(true_title)),
        ]
        for band, jd_title in bands:
            if not jd_title or not jds.get(jd_title):
                continue
            jd = jds[jd_title][0 if band == 'matched' else -1]
            pairs.append({
                'pair_id': f"{len(pairs) + 1:03d}",
                'band': band,
                'cv_file': cv['file'],
                'cv_true_title': true_title,
                'cv_scenario': cv['scenario'],
                'jd_id': jd['jd_id'],
                'jd_og_title': jd['og_title'],
                'jd_posting_title': jd['posting_title'],
                'jd_company': jd['company'],
                'jd_description': jd['description'],
            })

    os.makedirs(OUT_DIR, exist_ok=True)
    pairs_path = os.path.join(OUT_DIR, '10-cv-jd-pairs.json')
    with open(pairs_path, 'w', encoding='utf-8') as fh:
        json.dump({'pairs': pairs, 'jd_pool': jds}, fh, indent=2, ensure_ascii=False)

    review_path = os.path.join(OUT_DIR, '10-jd-review-sheet.md')
    with open(review_path, 'w', encoding='utf-8') as fh:
        fh.write('# JD label review — confirm before these are used as ground truth\n\n')
        fh.write('`og_title` is mapped heuristically from the Djinni Primary Keyword tag, '
                 'not assigned by a human. Check each posting actually matches its label; '
                 'mark ✗ on any that does not and it will be dropped.\n\n')
        for title in titles:
            for jd in jds.get(title, []):
                fh.write(f"## {title} — `{jd['jd_id']}`\n\n")
                fh.write(f"- **posting title:** {jd['posting_title']}\n")
                fh.write(f"- **company:** {jd['company']} · **exp:** {jd['exp_years']}\n")
                fh.write(f"- **label correct?** ☐ yes ☐ no\n\n")
                fh.write(f"> {jd['description'][:700]}...\n\n---\n\n")

    bands = {}
    for p in pairs:
        bands[p['band']] = bands.get(p['band'], 0) + 1
    print(f"pairs built: {len(pairs)}  {bands}")
    print(f"distinct CVs: {len({p['cv_file'] for p in pairs})}  "
          f"distinct JDs: {len({p['jd_id'] for p in pairs})}")
    print(f"written: {pairs_path}")
    print(f"review sheet: {review_path}")


if __name__ == '__main__':
    main()
