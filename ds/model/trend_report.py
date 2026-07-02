"""
Trend report over a jobs collection (default: JOBS_EXAMPLE).

For a set of tracked skills, computes their monthly prevalence (fraction of postings in
that month whose skills contain the term) bucketed by `datePosted`, writes a tidy CSV,
and — if matplotlib is available — a PNG line chart. This is the "trendiness graph":
stable skills (C#, Java) stay flat; trending skills (ML/AI) ramp up toward the end.

Usage:
  MONGO_URI=... EXAMPLE_COLLECTION=JOBS_EXAMPLE python trend_report.py
"""
import csv
import os
from collections import defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient

MONGO_URI  = os.getenv("MONGO_URI",
    "mongodb://localhost:27017/jobs")
COLLECTION = os.getenv("EXAMPLE_COLLECTION", "JOBS_EXAMPLE")
OUT_DIR    = os.getenv("REPORT_OUT_DIR", os.path.dirname(os.path.abspath(__file__)))

TRACK = [
    ("java", "stable"), ("c#", "stable"), (".net", "stable"), ("c++", "stable"),
    ("sql", "stable"),
    ("machine learning", "trending"), ("llm", "trending"), ("generative ai", "trending"),
    ("pytorch", "trending"), ("nlp", "trending"), ("computer vision", "trending"),
]


def parse_dt(raw):
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str) and raw:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def main():
    coll = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000).get_default_database()[COLLECTION]
    total_docs = coll.estimated_document_count()
    print(f"Collection {COLLECTION}: {total_docs} docs")

    month_total = defaultdict(int)
    month_skill = defaultdict(lambda: defaultdict(int))  # month -> skill -> count

    for d in coll.find({}, {"datePosted": 1, "skills": 1}):
        posted = parse_dt(d.get("datePosted"))
        if not posted:
            continue
        month = f"{posted.year:04d}-{posted.month:02d}"
        month_total[month] += 1
        sk = d.get("skills") or {}
        present = {m.get("doc_node_value", "").lower()
                   for m in (sk.get("full_matches", []) + sk.get("ngram_matches", []))}
        for term, _ in TRACK:
            if term in present:
                month_skill[month][term] += 1

    months = sorted(month_total)
    csv_path = os.path.join(OUT_DIR, "trend_report.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["month", "postings"] + [t for t, _ in TRACK])
        for m in months:
            row = [m, month_total[m]]
            for term, _ in TRACK:
                row.append(round(month_skill[m][term] / max(month_total[m], 1), 4))
            w.writerow(row)
    print(f"Wrote {csv_path}")

    # Console spar-summary: first vs last month prevalence.
    if months:
        first, last = months[0], months[-1]
        print(f"\nprevalence  {first} -> {last}")
        for term, kind in TRACK:
            a = month_skill[first][term] / max(month_total[first], 1)
            b = month_skill[last][term] / max(month_total[last], 1)
            print(f"  [{kind:8}] {term:18} {a:5.1%} -> {b:5.1%}")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.figure(figsize=(12, 6))
        for term, kind in TRACK:
            ys = [month_skill[m][term] / max(month_total[m], 1) for m in months]
            style = "-" if kind == "trending" else "--"
            plt.plot(months, ys, style, label=f"{term} ({kind})")
        plt.xticks(rotation=45, ha="right")
        plt.ylabel("prevalence (fraction of monthly postings)")
        plt.title(f"Skill trendiness over time — {COLLECTION}")
        plt.legend(loc="upper left", fontsize=8, ncol=2)
        plt.tight_layout()
        png_path = os.path.join(OUT_DIR, "trend_report.png")
        plt.savefig(png_path, dpi=120)
        print(f"Wrote {png_path}")
    except ImportError:
        print("(matplotlib not installed — CSV only; `pip install matplotlib` for the chart)")


if __name__ == "__main__":
    main()
