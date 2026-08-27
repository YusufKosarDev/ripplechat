#!/usr/bin/env bash
# Fail if the README's stated test counts and coverage no longer match reality.
#
# This exists because they silently stopped matching. A PR that added 31 backend
# and 17 frontend tests left every figure in the Testing table describing the
# suite as it was before — and a metrics table with one wrong number casts doubt
# on all of them.
#
# Only runs the checks it has evidence for. Each source is a build artifact, so
# on a bare checkout this is a no-op that reports what it skipped rather than
# guessing or failing.
#
#   backend tests   backend/target/surefire-reports/TEST-*.xml
#   backend lines   backend/target/site/jacoco/jacoco.xml
#   frontend tests  frontend/coverage/lcov.info + a vitest run
#   e2e scenarios   counted from frontend/e2e/*.spec.ts
set -euo pipefail

README="README.md"
bad=0
checked=0

fail() {
  echo "::error file=${README}::$1"
  echo "MISMATCH: $1"
  bad=1
}

# --- backend test count ------------------------------------------------------
reports="backend/target/surefire-reports"
if compgen -G "$reports/TEST-*.xml" > /dev/null; then
  actual=$(grep -ho 'tests="[0-9]*"' "$reports"/TEST-*.xml \
    | grep -o '[0-9]*' | awk '{n += $1} END {print n + 0}')
  stated=$(grep -oE '\*\*[0-9]+ tests · [0-9]+% line coverage\*\* \(JaCoCo\)' "$README" \
    | grep -oE '^\*\*[0-9]+' | grep -oE '[0-9]+' || true)
  checked=$((checked + 1))
  if [ -z "$stated" ]; then
    fail "could not find the backend test count in the Testing table"
  elif [ "$stated" != "$actual" ]; then
    fail "README says $stated backend tests; surefire reports $actual"
  fi
else
  echo "skipped backend test count (no surefire reports — run ./mvnw verify)"
fi

# --- backend line coverage ---------------------------------------------------
jacoco="backend/target/site/jacoco/jacoco.xml"
if [ -f "$jacoco" ]; then
  # The report's own totals are the last LINE counter in the file.
  read -r missed covered < <(grep -o '<counter type="LINE" missed="[0-9]*" covered="[0-9]*"/>' "$jacoco" \
    | tail -1 | grep -o '[0-9]*' | paste -sd' ' -)
  actual=$(( (covered * 100 + (covered + missed) / 2) / (covered + missed) ))
  stated=$(grep -oE '\*\*[0-9]+ tests · [0-9]+% line coverage\*\* \(JaCoCo\)' "$README" \
    | grep -oE '· [0-9]+%' | grep -oE '[0-9]+' || true)
  checked=$((checked + 1))
  if [ -n "$stated" ] && [ "$stated" != "$actual" ]; then
    fail "README says ${stated}% backend line coverage; JaCoCo reports ${actual}%"
  fi
else
  echo "skipped backend coverage (no jacoco.xml — run ./mvnw verify)"
fi

# --- e2e scenario count ------------------------------------------------------
# Always-run specs are the ones without a SHOTS gate; the gated files are the
# screenshot and demo-reel generators.
if [ -d frontend/e2e ]; then
  always=0; gated=0
  for f in frontend/e2e/*.spec.ts; do
    n=$(grep -cE "^\s*test\(|^\s*test\.each|^\s*it\(" "$f" || true)
    if grep -q "process.env.SHOTS" "$f"; then gated=$((gated + n)); else always=$((always + n)); fi
  done
  stated=$(grep -oE '\*\*[0-9]+ scenarios\*\* \(\+[0-9]+ ' "$README" | grep -oE '[0-9]+' | head -1 || true)
  stated_gated=$(grep -oE '\*\*[0-9]+ scenarios\*\* \(\+[0-9]+ ' "$README" | grep -oE '[0-9]+' | tail -1 || true)
  checked=$((checked + 1))
  if [ -n "$stated" ] && [ "$stated" != "$always" ]; then
    fail "README says $stated e2e scenarios; frontend/e2e has $always always-run"
  fi
  if [ -n "$stated_gated" ] && [ "$stated_gated" != "$gated" ]; then
    fail "README says +$stated_gated generators; frontend/e2e has $gated SHOTS-gated"
  fi
fi

# --- frontend test count -----------------------------------------------------
# From vitest's own JSON report, not a grep: `it.each` is one call site and six
# tests, so counting source lines undercounts by exactly the kind of margin that
# makes a stated figure wrong.
vitest_report="frontend/coverage/vitest-report.json"
if [ -f "$vitest_report" ]; then
  actual=$(grep -o '"numTotalTests":[0-9]*' "$vitest_report" | head -1 | grep -o '[0-9]*')
  stated=$(grep -oE '\*\*[0-9]+ tests · [0-9]+% line coverage\*\* \(v8\)' "$README" \
    | grep -oE '^\*\*[0-9]+' | grep -oE '[0-9]+' || true)
  checked=$((checked + 1))
  if [ -n "$stated" ] && [ -n "$actual" ] && [ "$stated" != "$actual" ]; then
    fail "README says $stated frontend tests; vitest reports $actual"
  fi
else
  echo "skipped frontend test count (no vitest report — run npm run test:coverage)"
fi

# --- frontend line coverage --------------------------------------------------
lcov="frontend/coverage/lcov.info"
if [ -f "$lcov" ]; then
  lf=$(grep -h '^LF:' "$lcov" | cut -d: -f2 | awk '{n += $1} END {print n + 0}')
  lh=$(grep -h '^LH:' "$lcov" | cut -d: -f2 | awk '{n += $1} END {print n + 0}')
  actual=$(( (lh * 100 + lf / 2) / lf ))
  stated=$(grep -oE '\*\*[0-9]+ tests · [0-9]+% line coverage\*\* \(v8\)' "$README" \
    | grep -oE '· [0-9]+%' | grep -oE '[0-9]+' || true)
  checked=$((checked + 1))
  if [ -n "$stated" ] && [ "$stated" != "$actual" ]; then
    fail "README says ${stated}% frontend line coverage; v8 reports ${actual}%"
  fi
else
  echo "skipped frontend coverage (no lcov.info — run npm run test:coverage)"
fi

if [ "$bad" -eq 0 ]; then
  echo "OK: $checked README figure(s) match the build output."
fi
exit "$bad"
