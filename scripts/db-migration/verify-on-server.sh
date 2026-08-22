#!/usr/bin/env bash
# Verify the restore on the production host: exact document counts against the
# expected-counts.txt captured from local at dump time, plus a check that no
# training-only collection leaked in. Read-only.
#
# Usage:  ./verify-on-server.sh
# Requires MONGO_URI (see restore-on-server.sh).

set -euo pipefail

BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED="$BUNDLE/db/expected-counts.txt"
TARGET_DB="${TARGET_DB:-careerlens}"
CONTAINER="${MONGO_CONTAINER:-mongodb}"

if [[ -z "${MONGO_URI:-}" ]]; then
    echo "ERROR: MONGO_URI is not set." >&2
    exit 2
fi
[[ -f "$EXPECTED" ]] || { echo "ERROR: missing $EXPECTED" >&2; exit 2; }

if command -v mongosh >/dev/null 2>&1; then
    run_js() { mongosh "$MONGO_URI" --quiet --norc --eval "$1"; }
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    run_js() { docker exec "$CONTAINER" mongosh "$MONGO_URI" --quiet --norc --eval "$1"; }
else
    echo "ERROR: no mongosh on the host and no running '$CONTAINER' container." >&2
    exit 3
fi

echo "=== Document counts (exact)"
printf '  %-28s %12s %12s   %s\n' COLLECTION EXPECTED ACTUAL STATUS

FAIL=0
while read -r coll expected; do
    [[ -z "${coll:-}" || "$coll" == \#* ]] && continue
    actual="$(run_js "print(db.getSiblingDB('${TARGET_DB}').getCollection('${coll}').countDocuments({}))" | tr -d '\r' | tail -1)"
    if [[ "$actual" == "$expected" ]]; then
        printf '  %-28s %12s %12s   MATCH\n' "$coll" "$expected" "$actual"
    else
        printf '  %-28s %12s %12s   MISMATCH\n' "$coll" "$expected" "$actual"
        FAIL=$((FAIL + 1))
    fi
done < "$EXPECTED"

echo
echo "=== Training-data leak check"
LEAK_JS="
var never = ['lang-uk-cv','lang-uk-cv-skills','lang-uk-cv-sample','lang-uk-cv-other-sample',
             'lang-uk-cv-other-skills','lang-uk-job-sample','master-resumes-sample',
             'master-resumes-skills','augmented-2026','JOB_EXAMPLE','job-PocOnly'];
var x = db.getSiblingDB('${TARGET_DB}');
var have = x.getCollectionNames();
var bad = never.filter(function(c){ return have.indexOf(c) >= 0; });
print(bad.length ? 'LEAKED: ' + bad.join(', ') : 'clean');
"
LEAK="$(run_js "$LEAK_JS" | tr -d '\r' | tail -1)"
echo "  $LEAK"
[[ "$LEAK" == "clean" ]] || FAIL=$((FAIL + 1))

echo
echo "=== Indexes"
run_js "
var x = db.getSiblingDB('${TARGET_DB}');
x.getCollectionNames().sort().forEach(function(c){
  print('  ' + c + ': ' + x.getCollection(c).getIndexes().map(function(i){return i.name;}).join(', '));
});"

echo
if [[ $FAIL -eq 0 ]]; then
    echo "PASS - counts match and nothing leaked."
    echo
    echo "Remaining manual checks:"
    echo "  - backend starts and connects"
    echo "  - register a user"
    echo "  - role selector populated"
    echo "  - upload CV -> analyze"
    echo "  - admin model-status screen"
    exit 0
else
    echo "FAIL - $FAIL problem(s) above." >&2
    exit 1
fi
