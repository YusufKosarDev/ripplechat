#!/usr/bin/env bash
# Fail if any tracked, non-binary file contains a NUL byte.
#
# A NUL byte in a text file is a reliable signal of encoding corruption —
# typically a UTF-16/mojibake fragment accidentally written into an otherwise
# UTF-8 file (e.g. a PowerShell `Out-File` default-encoding append). That kind
# of corruption once slipped a UTF-16 OAuth2 block into
# backend/src/main/resources/application.properties, which git then treated as
# binary and Spring mis-parsed. This guard keeps text files genuinely text.
#
# Files marked `binary` in .gitattributes (images, jars, fonts, ...) are skipped.
set -euo pipefail

bad=0
while IFS= read -r -d '' f; do
  # Skip anything .gitattributes declares binary.
  attr=$(git check-attr binary -- "$f" | sed 's/.*: //')
  [ "$attr" = "set" ] && continue

  if grep -aqP '\x00' -- "$f" 2>/dev/null; then
    echo "::error file=${f}::NUL byte found in tracked text file (encoding corruption — expected UTF-8)"
    echo "ERROR: NUL byte in text file: $f"
    bad=1
  fi
done < <(git ls-files -z)

if [ "$bad" -eq 0 ]; then
  echo "OK: no NUL bytes in tracked text files."
fi
exit "$bad"
