"""
Unit tests for stability.py's compute_stability_features (pure function, no Mongo/
training run needed) plus a smoke test of /title/trending-skills' new response fields
against a mocked server.feature_matrix (same style as test_preferences.py's MOCK_MATRIX,
but that file's own rank_skills/SkillPreferences/title_match references are pre-existing
dead code against the current server.py — this file does not build on it).

Run:
  python ds/model/test_stability.py
"""
import sys

sys.path.insert(0, __file__.replace('test_stability.py', ''))
from stability import compute_stability_features, MIN_RELIABLE_MONTHS

failures = 0


def check(label, condition, detail=''):
    global failures
    if condition:
        print(f"PASS {label}")
    else:
        print(f"FAIL {label}{f' — {detail}' if detail else ''}")
        failures += 1


# ── compute_stability_features — hand-built monthly fixture ───────────────────
# 6 months, title "DevOps Engineer":
#   "java"       — flat: present in every month at a constant rate -> stability_score near 0
#   "llm"        — rising: 0 in early months, ramps up sharply -> stability_score near 1
#   "kubernetes" — present in only 2 of 6 months -> below MIN_RELIABLE_MONTHS, neutral default

MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
TITLE = "DevOps Engineer"

role_month_totals = {TITLE: {m: 100 for m in MONTHS}}
role_skill_month_counts = {
    TITLE: {
        "java":       {m: 40 for m in MONTHS},                       # flat 40%
        "llm":        dict(zip(MONTHS, [1, 2, 5, 15, 40, 70])),       # sharp ramp
        "kubernetes": {"2026-01": 20, "2026-02": 22},                 # only 2 months
    }
}

result = compute_stability_features(
    [TITLE], role_skill_month_counts, role_month_totals
)
devops = result[TITLE]

check(
    "flat skill (java) gets a low stability_score",
    devops["java"]["stability_score"] < 0.5,
    f"got {devops['java']}"
)
check(
    "sharply rising skill (llm) gets a high stability_score",
    devops["llm"]["stability_score"] > devops["java"]["stability_score"],
    f"java={devops['java']['stability_score']} llm={devops['llm']['stability_score']}"
)
check(
    "llm's growth_trend is positive (rising)",
    devops["llm"]["growth_trend"] > 0,
    f"got {devops['llm']['growth_trend']}"
)
check(
    "java and llm are both marked time_features_reliable",
    devops["java"]["time_features_reliable"] and devops["llm"]["time_features_reliable"]
)
check(
    "sparse skill (kubernetes, <MIN_RELIABLE_MONTHS) gets the neutral default",
    devops["kubernetes"]["stability_score"] == 0.5
    and devops["kubernetes"]["growth_trend"] == 0.0
    and devops["kubernetes"]["time_features_reliable"] is False,
    f"got {devops['kubernetes']}"
)

# ── Title with too few total months (< MIN_RELIABLE_MONTHS) — every skill neutral ──

SPARSE_TITLE = "Kernel Developer"
sparse_totals = {SPARSE_TITLE: {"2026-05": 10, "2026-06": 12}}  # only 2 months total
sparse_counts = {SPARSE_TITLE: {"c": {"2026-05": 5, "2026-06": 6}}}
assert len(sparse_totals[SPARSE_TITLE]) < MIN_RELIABLE_MONTHS

sparse_result = compute_stability_features([SPARSE_TITLE], sparse_counts, sparse_totals)
check(
    "title with < MIN_RELIABLE_MONTHS total months -> every skill gets the neutral default",
    sparse_result[SPARSE_TITLE]["c"]["stability_score"] == 0.5
    and sparse_result[SPARSE_TITLE]["c"]["time_features_reliable"] is False
)

# ── /title/trending-skills response fields, via a mocked server.feature_matrix ────

try:
    import server  # noqa: E402  (imports after sys.path tweak above; loads real model.joblib)

    MOCK_MATRIX = {
        "DevOps Engineer": {
            "java": {
                "frequency": 200, "prevalence": 1.0, "recent_prevalence": 0.9, "trend": "stable",
                "growth_trend": -0.05, "stability_score": 0.05, "time_features_reliable": True,
            },
            "llm": {
                "frequency": 50, "prevalence": 0.4, "recent_prevalence": 0.9, "trend": "rising",
                "growth_trend": 0.95, "stability_score": 0.95, "time_features_reliable": True,
            },
        }
    }
    original_fm = server.feature_matrix
    server.feature_matrix = MOCK_MATRIX
    try:
        response = server.trending_skills("DevOps Engineer", n=10)
    finally:
        server.feature_matrix = original_fm

    by_skill = {s["skill"]: s for s in response["skills"]}
    check(
        "trending_skills response includes stability_score/growth_trend/time_features_reliable",
        all(
            k in by_skill["java"] for k in ("stability_score", "growth_trend", "time_features_reliable")
        ),
        f"got keys {list(by_skill.get('java', {}).keys())}"
    )
    check(
        "trending_skills preserves the mocked stability values",
        by_skill["java"]["stability_score"] == 0.05 and by_skill["llm"]["stability_score"] == 0.95
    )
except ImportError as e:
    print(f"SKIP server import tests: {e} (server.py needs its full ML dependency stack installed)")

print(f"\n{'All tests passed.' if not failures else f'{failures} test(s) FAILED.'}")
sys.exit(1 if failures else 0)
