#!/usr/bin/env bash
# Fail if Java source writes a type inline fully-qualified instead of importing it.
#
# Why a grep and not an ArchUnit rule: ArchUnit reads bytecode, where an import
# and an inline fully-qualified reference compile to the identical constant-pool
# entry. The distinction only exists in source, so it can only be enforced here.
#
# This is a readability rule, not a correctness one. The codebase had drifted to
# lines like:
#     private final com.ripplechat.backend.notification.NotificationService x;
#     public java.util.Map<String, Boolean> providers() {
# in a handful of files while the other ~200 used imports.
#
# One thing is deliberately exempt: JPQL/SQL inside @Query strings, where an enum
# literal genuinely needs the fully-qualified name and an import cannot help.
set -euo pipefail

# Packages that should always be reachable via an import. The (\.[a-z]...)* group
# has to allow zero repeats: java.util.Map has the type right after the root,
# while com.ripplechat.backend.message.MessageService has three more segments.
PATTERN='(^|[^a-zA-Z0-9_."])(java\.(util|net|time|security|nio)|jakarta\.(persistence|validation)|org\.springframework|com\.ripplechat)(\.[a-z][a-zA-Z0-9_]*)*\.[A-Z]'

bad=0
while IFS= read -r -d '' f; do
  # Blank out text blocks before matching, keeping line numbers intact. A @Query
  # body spans lines carrying no quote character of their own, so a per-line
  # quote filter alone would not exclude them.
  hits=$(awk 'BEGIN { inblock = 0 }
              /"""/ { inblock = !inblock; print ""; next }
              { print (inblock ? "" : $0) }' "$f" \
    | grep -nE "$PATTERN" \
    | grep -vE '^[0-9]+:\s*(import|package|\*|//|/\*)' \
    | grep -vE '^[0-9]+:.*"' \
    || true)

  if [ -n "$hits" ]; then
    while IFS= read -r line; do
      n=${line%%:*}
      echo "::error file=${f},line=${n}::inline fully-qualified type — add an import instead"
      echo "ERROR: $f:$line"
    done <<< "$hits"
    bad=1
  fi
done < <(git ls-files -z 'backend/src/main/java/**/*.java' 'backend/src/test/java/**/*.java')

if [ "$bad" -eq 0 ]; then
  echo "OK: no inline fully-qualified types in Java sources."
fi
exit "$bad"
