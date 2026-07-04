"""
DS-7: Integration tests for skill preferences.

Unit tests use a mock feature_matrix so they test logic, not real data trends.
Smoke tests hit a running server at localhost:8000.

Run:
  python ds/model/test_preferences.py
"""
import sys
import requests

# ── Import server module for unit tests ───────────────────────────────────────
sys.path.insert(0, __file__.replace('test_preferences.py', ''))
import server
from server import rank_skills, SkillPreferences

# ── Mock feature_matrix ───────────────────────────────────────────────────────
# python:        high prevalence, low specificity (appears in every role)
# bash:          mid prevalence, high specificity (very DevOps-specific)
# kubernetes:    mid prevalence, high specificity
# terraform:     lower prevalence, high specificity
# communication: low prevalence, very low specificity (generic noise)

MOCK_MATRIX = {
    "DevOps Engineer": {
        # High prevalence, low specificity - stays in top-5 for title_match=0
        "python":        {"frequency": 200, "prevalence": 1.0,  "title_specificity": 0.1},
        "bash":          {"frequency": 140, "prevalence": 0.7,  "title_specificity": 0.9},
        "linux":         {"frequency": 130, "prevalence": 0.65, "title_specificity": 0.75},
        "kubernetes":    {"frequency": 120, "prevalence": 0.6,  "title_specificity": 0.85},
        # sql: medium prevalence, near-zero specificity → rank 5 with title_match=0, rank 6 with title_match=1
        "sql":           {"frequency":  90, "prevalence": 0.45, "title_specificity": 0.05},
        # terraform: low prevalence, very high specificity → rank 6 with title_match=0, rank 5 with title_match=1
        "terraform":     {"frequency":  80, "prevalence": 0.3,  "title_specificity": 0.99},
        # Always rank 7 - should never appear in top-5
        "communication": {"frequency":  30, "prevalence": 0.15, "title_specificity": 0.05},
    }
}

original_fm = server.feature_matrix
server.feature_matrix = MOCK_MATRIX
failures = 0

# ── Unit tests ────────────────────────────────────────────────────────────────

# Test 1: title_match=1.0 surfaces specific skills over generic ones
high = rank_skills("DevOps Engineer", SkillPreferences(title_match=1.0))
low  = rank_skills("DevOps Engineer", SkillPreferences(title_match=0.0))
diff = set(high) - set(low)
if not diff:
    print(f"FAIL unit-1: title_match=1.0 vs 0.0 - no difference\n  high={high}\n  low={low}")
    failures += 1
else:
    print(f"PASS unit-1: {len(diff)} skill(s) differ - {diff}")

# Test 2: title_match=0.0 → python (prevalence=1.0) must be first
if low[0] != "python":
    print(f"FAIL unit-2: pure prevalence should rank python first, got {low}")
    failures += 1
else:
    print("PASS unit-2: python is #1 with title_match=0.0")

# Test 3: communication (low on both axes) never appears in top-5
for label, prefs in [
    ("default",    SkillPreferences()),
    ("max_match",  SkillPreferences(title_match=1.0)),
]:
    skills = rank_skills("DevOps Engineer", prefs)
    if "communication" in skills:
        print(f"FAIL unit-3 [{label}]: 'communication' appeared in top-5: {skills}")
        failures += 1
    else:
        print(f"PASS unit-3 [{label}]: 'communication' correctly excluded")

# Test 4: python (prevalence=1.0) stays in top-5 even with title_match=1.0
if "python" not in high:
    print(f"FAIL unit-4: python missing from top-5 with title_match=1.0: {high}")
    failures += 1
else:
    print("PASS unit-4: python (high prevalence) stays in top-5 with title_match=1.0")

server.feature_matrix = original_fm

# ── Smoke tests ───────────────────────────────────────────────────────────────
BASE       = "http://localhost:8000"
POC_TITLES = ["Software Engineer", "Data Scientist", "Product Manager",
              "DevOps Engineer", "Frontend Developer"]

try:
    for title in POC_TITLES:
        r      = requests.get(f"{BASE}/title/skills", params={"title": title}, timeout=5)
        body   = r.json()
        skills = body.get("suggested_skills", [])
        canon  = body.get("matched_canonical", "")

        if r.status_code != 200 or len(skills) != 5:
            print(f"FAIL smoke [{title}]: status={r.status_code}, skills={skills}")
            failures += 1
        elif canon not in POC_TITLES:
            print(f"FAIL smoke [{title}]: matched_canonical='{canon}' not in POC_TITLES")
            failures += 1
        else:
            print(f"PASS smoke [{title}]: {skills} | canonical={canon}")

    r = requests.get(f"{BASE}/title/skills",
                     params={"title": "DevOps Engineer", "title_match": 2.0}, timeout=5)
    if r.status_code == 422:
        print("PASS smoke: out-of-range title_match=2.0 → 422")
    else:
        print(f"FAIL smoke: expected 422, got {r.status_code}")
        failures += 1

except requests.ConnectionError:
    print("SKIP smoke: server not running at localhost:8000")

# ── Result ────────────────────────────────────────────────────────────────────
print(f"\n{'✓ All tests passed.' if not failures else f'✗ {failures} test(s) FAILED.'}")
sys.exit(1 if failures else 0)
