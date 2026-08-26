#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""One-shot production snapshot: answers every open question in
docs/progect_book/defence/production-questions.md.

Run it on the deployment host. Everything is read-only - it loads the served
artifact, reads two collections, and makes two HTTP GETs. Nothing is written and
no model is retrained.

    python 23_production_snapshot.py

    # or, if the DS container is where the artifact and env live:
    docker cp 23_production_snapshot.py careerlens-ds:/tmp/
    docker exec careerlens-ds python /tmp/23_production_snapshot.py

Each section is independent: if Mongo or the DS server is unreachable, that
section reports the failure and the rest still runs. A JSON block is printed at
the end - paste that back and it answers questions 1-7 in one go.

Environment it reads (all optional, defaults match the DS server's own):
    MODEL_PATH                  served artifact          default ds/model/model.joblib
    CANONICAL_TITLES_PATH       record counts            default alongside MODEL_PATH
    MONGO_URI                   jobs database            default mongodb://localhost:27017/jobs
    DS_URL                      DS server base URL       default http://localhost:8000
    SKILL_UBIQUITY_CAP / ROLE_COUNT_MIN_PREVALENCE / AGREEMENT_SIGNAL_ENABLED
"""
import json
import os
import statistics
import sys
from collections import Counter

REPORT = {}


def section(title):
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def safe(name):
    """Run a section, record the failure instead of aborting the whole script."""
    def deco(fn):
        try:
            fn()
        except Exception as exc:                                  # noqa: BLE001
            print("  !! %s: %s" % (type(exc).__name__, exc))
            REPORT.setdefault("errors", {})[name] = "%s: %s" % (type(exc).__name__, exc)
        return fn
    return deco


# --------------------------------------------------------------------------- 0. env
section("0. Effective environment  (question 7, and the context for everything else)")

ENV_KEYS = ["MODEL_PATH", "CANONICAL_TITLES_PATH", "MONGO_URI", "DS_URL",
            "SKILL_UBIQUITY_CAP", "ROLE_COUNT_MIN_PREVALENCE", "AGREEMENT_SIGNAL_ENABLED",
            "RECENCY_HALF_LIFE_DAYS", "TREND_WINDOW_DAYS", "TRAIN_USE_UNIFIED",
            "SOURCE_WEIGHTS", "SOURCE_EXCLUDE"]
DEFAULTS = {"SKILL_UBIQUITY_CAP": "48 (server default)",
            "ROLE_COUNT_MIN_PREVALENCE": "0.0 (server default)",
            "AGREEMENT_SIGNAL_ENABLED": "0 (server default)",
            "RECENCY_HALF_LIFE_DAYS": "14 (train default)",
            "TREND_WINDOW_DAYS": "7 (train default)"}

env = {}
for k in ENV_KEYS:
    v = os.getenv(k)
    env[k] = v
    print("  %-26s %s" % (k, v if v is not None else "<unset> -> " + DEFAULTS.get(k, "n/a")))
REPORT["env"] = env

MODEL_PATH = os.getenv("MODEL_PATH") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "ds", "model", "model.joblib")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/jobs")
DS_URL = os.getenv("DS_URL", "http://localhost:8000").rstrip("/")
UBIQUITY_CAP = int(os.getenv("SKILL_UBIQUITY_CAP", "48"))

# --------------------------------------------------------------------------- 1. artifact
section("1. The served artifact")

fm = {}


@safe("artifact")
def _artifact():
    global fm
    import joblib
    print("  loading:", MODEL_PATH)
    art = joblib.load(MODEL_PATH)
    fm = art.get("feature_matrix", {})
    rows = sum(len(v) for v in fm.values())
    populated = {r: len(v) for r, v in fm.items() if v}
    print("  trained_at        :", art.get("trained_at"))
    print("  roles with skills :", len(populated), "of", len(fm))
    print("  (role, skill) rows:", format(rows, ","))
    REPORT["artifact"] = {"path": MODEL_PATH, "trained_at": art.get("trained_at"),
                          "roles_with_skills": len(populated), "roles_total": len(fm),
                          "role_skill_rows": rows}


# --------------------------------------------------------------------------- 2. trend
section("2. Trend labels  (question 1)  -  as stored, and as the server serves them")


@safe("trend")
def _trend():
    stored = Counter(f.get("trend", "?") for r in fm.values() for f in r.values())
    print("  AS STORED (train.py fixed thresholds 1.25 / 0.80):")
    print("   ", dict(stored))

    # exactly what server.recalibrate_trend_labels does, without mutating anything
    ratios = []
    missing = 0
    for skills in fm.values():
        for f in skills.values():
            p, rp = f.get("prevalence") or 0, f.get("recent_prevalence")
            if p > 0 and rp is not None and rp > 0:
                ratios.append(rp / p)
            else:
                missing += 1

    served = {"relabeled": False, "reason": "fewer than 100 usable ratios"}
    if len(ratios) >= 100:
        ratios.sort()
        rise_cut = max(ratios[int(len(ratios) * 0.80)], 1.05)
        fall_cut = min(ratios[int(len(ratios) * 0.20)], 0.95)
        counts = Counter()
        for skills in fm.values():
            for f in skills.values():
                p, rp = f.get("prevalence") or 0, f.get("recent_prevalence")
                if p > 0 and rp is not None and rp > 0:
                    ratio = rp / p
                    counts["rising" if ratio >= rise_cut else
                           "falling" if ratio <= fall_cut else "stable"] += 1
                else:
                    counts["stable"] += 1
        served = {"relabeled": True, "rise_cut": round(rise_cut, 4),
                  "fall_cut": round(fall_cut, 4), "counts": dict(counts)}
        print("  AS SERVED (server.py quintile recalibration):")
        print("   ", served)
    else:
        print("  AS SERVED:", served)

    total = sum(stored.values()) or 1
    print("  rows with NO recent_prevalence: %s (%.1f%%) - labelled 'stable' by default,"
          % (format(missing, ","), 100 * missing / total))
    print("    not by measurement. This is the caveat that must travel with the number.")
    REPORT["trend"] = {"stored": dict(stored), "served": served,
                       "rows_without_recent_prevalence": missing,
                       "pct_without_recent_prevalence": round(100 * missing / total, 1)}


# --------------------------------------------------------------------------- 3. stability
section("3. Stability-score distribution  (question 2)")


@safe("stability")
def _stability():
    vals = [f["stability_score"] for r in fm.values() for f in r.values()
            if f.get("stability_score") is not None]
    reliable = sum(1 for r in fm.values() for f in r.values()
                   if f.get("time_features_reliable"))
    if not vals:
        print("  no stability_score present in the artifact")
        return
    ge = sum(v >= 0.95 for v in vals)
    le = sum(v <= 0.05 for v in vals)
    print("  n                      :", format(len(vals), ","))
    print("  >= 0.95                : %s  (%.1f%%)" % (format(ge, ","), 100 * ge / len(vals)))
    print("  <= 0.05                : %s  (%.1f%%)" % (format(le, ","), 100 * le / len(vals)))
    print("  median                 :", round(statistics.median(vals), 4))
    print("  time_features_reliable :", format(reliable, ","), "of", format(len(vals), ","))
    print("  -> the book claims 118 of 120 served candidates sit at >= 0.95.")
    print("     If the share above is far from that, the preset-collapse limitation is stale.")
    REPORT["stability"] = {"n": len(vals), "ge_0_95": ge, "le_0_05": le,
                           "median": round(statistics.median(vals), 4),
                           "time_features_reliable": reliable}


# --------------------------------------------------------------------------- 4. coverage
section("4. Role coverage and record counts  (question 3)")


@safe("coverage")
def _coverage():
    ct_path = os.getenv("CANONICAL_TITLES_PATH") or os.path.join(
        os.path.dirname(os.path.abspath(MODEL_PATH)), "canonical_titles.json")
    counts = {}
    if os.path.exists(ct_path):
        with open(ct_path, encoding="utf-8") as fh:
            counts = json.load(fh).get("record_counts", {})
        print("  record counts from:", ct_path)
    else:
        print("  !! canonical_titles.json not found at", ct_path)

    if counts:
        with_data = sum(1 for c in counts.values() if c > 0)
        ge50 = sum(1 for c in counts.values() if c >= 50)
        thin = sorted(((c, t) for t, c in counts.items() if 0 < c < 50))
        print("  roles with any data :", with_data, "of", len(counts))
        print("  roles >= 50 records :", ge50)
        print("  total records       :", format(sum(counts.values()), ","))
        print("  served on thin data (<50 records):")
        for c, t in thin:
            print("      %-38s %4d" % (t, c))
        REPORT["coverage"] = {"roles_with_data": with_data, "roles_ge_50": ge50,
                              "roles_total": len(counts),
                              "total_records": sum(counts.values()),
                              "thin_roles": {t: c for c, t in thin}}


# --------------------------------------------------------------------------- 5. ubiquity
section("5. Ubiquity cap  (question 7)  -  is the deployed cap still calibrated?")


@safe("ubiquity")
def _ubiquity():
    role_counts = Counter()
    for skills in fm.values():
        for s in skills:
            role_counts[s] += 1
    n_roles = sum(1 for v in fm.values() if v)
    filtered = sum(1 for c in role_counts.values() if c > UBIQUITY_CAP)
    # The 0.92 ratio the cap of 11 encoded when the taxonomy carried 12 roles,
    # rescaled to the taxonomy in this artifact. Scaling UBIQUITY_CAP itself
    # would be wrong - that is the value in force, not the value being rescaled.
    equivalent = round(11 * n_roles / 12) if n_roles else UBIQUITY_CAP
    print("  roles with data        :", n_roles)
    print("  SKILL_UBIQUITY_CAP     :", UBIQUITY_CAP)
    print("  skills above the cap   : %s of %s (these are hidden from every list)"
          % (format(filtered, ","), format(len(role_counts), ",")))
    print("  cap of 11 was tuned for 12 roles (ratio 0.92);")
    print("    the equivalent cap for %d roles is %d" % (n_roles, round(11 * n_roles / 12)))
    print("  notable skills and how many roles carry them:")
    for s in ("kubernetes", "terraform", "pytorch", "typescript", "graphql",
              "python", "docker", "sql", "llm"):
        c = role_counts.get(s)
        if c is not None:
            flag = "  <-- FILTERED OUT at the current cap" if c > UBIQUITY_CAP else ""
            print("      %-12s %3d roles%s" % (s, c, flag))
    REPORT["ubiquity"] = {"cap": UBIQUITY_CAP, "roles_with_data": n_roles,
                          "skills_filtered": filtered, "distinct_skills": len(role_counts),
                          "equivalent_cap": equivalent,
                          "notable": {s: role_counts.get(s) for s in
                                      ("kubernetes", "terraform", "pytorch", "typescript",
                                       "graphql", "python", "docker", "sql", "llm")}}


# --------------------------------------------------------------------------- 6. mongo
section("6. Nightly runs and corpus split  (questions 4 and 5)")


@safe("mongo")
def _mongo():
    from pymongo import MongoClient
    db = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000).get_default_database()
    print("  database:", MONGO_URI.split("@")[-1])

    runs = list(db["model_runs"].find({}, {
        "trained_at": 1, "promoted": 1, "promote_reason": 1, "titles_with_data": 1,
        "half_life_days": 1, "trend_window_days": 1, "source_weights": 1,
        "source_exclude": 1}).sort([("trained_at", 1)]))
    promoted = sum(1 for r in runs if r.get("promoted"))
    print("  model_runs recorded :", len(runs), "| promoted:", promoted)
    if runs:
        print("  first run           :", runs[0].get("trained_at"))
        print("  last run            :", runs[-1].get("trained_at"),
              "| promoted:", runs[-1].get("promoted"),
              "|", runs[-1].get("promote_reason"))
        print("  the last run's training parameters - this settles whether the nightly job")
        print("  uses the 365-day windows or falls back to the 14/7 defaults:")
        for k in ("half_life_days", "trend_window_days", "source_weights", "source_exclude"):
            print("      %-20s %s" % (k, runs[-1].get(k)))
        print("  last 10 runs:")
        for r in runs[-10:]:
            print("      %-18s promoted=%-5s %s" % (r.get("trained_at"), r.get("promoted"),
                                                    (r.get("promote_reason") or "")[:60]))
    REPORT["model_runs"] = {
        "recorded": len(runs), "promoted": promoted,
        "first": runs[0].get("trained_at") if runs else None,
        "last": runs[-1].get("trained_at") if runs else None,
        "last_params": {k: runs[-1].get(k) for k in
                        ("half_life_days", "trend_window_days", "source_weights",
                         "source_exclude", "promoted", "promote_reason")} if runs else None}

    by_source = list(db["jobs"].aggregate([
        {"$group": {"_id": {"$toLower": {"$ifNull": ["$source", "unknown"]}},
                    "n": {"$sum": 1},
                    "earliest": {"$min": "$datePosted"},
                    "latest": {"$max": "$datePosted"}}},
        {"$sort": {"n": -1}}]))
    print("  jobs collection by source:")
    for row in by_source:
        print("      %-18s %8s   %s .. %s" % (row["_id"], format(row["n"], ","),
                                              row.get("earliest"), row.get("latest")))
    no_date = db["jobs"].count_documents({"datePosted": None})
    print("      postings with datePosted=null:", format(no_date, ","),
          "- these can never fall inside the trend window")
    REPORT["corpus"] = {"by_source": {r["_id"]: r["n"] for r in by_source},
                        "null_dates": no_date,
                        "total": sum(r["n"] for r in by_source)}


# --------------------------------------------------------------------------- 7. live
section("7. What the DS server actually serves  (question 6)")


@safe("ds")
def _ds():
    import urllib.request
    served = {}
    for role in ("Frontend Developer", "Data Scientist", "Machine Learning Engineer"):
        url = "%s/title/skills?title=%s&top_n=5" % (DS_URL, urllib.parse.quote(role))
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.load(resp)
        served[role] = {"suggested_skills": data.get("suggested_skills"),
                        "records_count": data.get("records_count"),
                        "data_confidence": data.get("data_confidence"),
                        "limited_data": data.get("limited_data"),
                        "trained_at": data.get("trained_at")}
        print("  %-28s %s" % (role, data.get("suggested_skills")))
        print("  %-28s records=%s confidence=%s limited=%s trained_at=%s"
              % ("", data.get("records_count"), data.get("data_confidence"),
                 data.get("limited_data"), data.get("trained_at")))
    print("  book reference: Frontend Developer was measured as")
    print("    ['typescript', 'react', 'node js', 'html', 'css']")
    REPORT["served"] = served


# --------------------------------------------------------------------------- output
section("JSON - paste this back")
print(json.dumps(REPORT, indent=2, ensure_ascii=False, default=str))

out = os.path.join(os.getcwd(), "production_snapshot.json")
try:
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(REPORT, fh, indent=2, ensure_ascii=False, default=str)
    print("\nalso written to:", out)
except OSError as exc:
    print("\n(could not write the file: %s - the JSON above is the whole answer)" % exc)

print("\nAlso worth capturing, and not available from inside this script:")
print("    docker compose logs ds | grep -E 'trend recalibration|agreement signal'")
sys.exit(0)
