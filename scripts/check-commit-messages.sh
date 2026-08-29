#!/usr/bin/env bash
# Scan commit messages for automatically added attribution lines.
#
# This is the single source of truth for the patterns. The commit-msg hook
# calls it with --message-file to check a message before it is written; CI
# calls it with --range to check what a push or pull request adds. Keeping one
# implementation means the local and the remote check cannot drift apart.
#
# Two tiers, because they carry very different false-positive risk:
#
#   HARD  Trailers, session URLs and generation credits. Machine-appended
#         shapes that do not occur in prose written by hand, so a match always
#         fails.
#   SOFT  A tool or vendor name in free text. Reported, never failing: this
#         repository ships a summarisation feature and takes dependency bumps
#         whose coordinates legitimately contain the same names.
#
# Usage:
#   check-commit-messages.sh --message-file <path>   one message (hook)
#   check-commit-messages.sh --range <rev>..<rev>    every commit in a range
#   check-commit-messages.sh --all                   every commit in the repo
#
# Exit: 0 clean (soft notices allowed), 1 a hard rule matched.
# Set COMMIT_MSG_STRICT=1 to make soft notices fail too.
set -uo pipefail

# --- the rules ---------------------------------------------------------------
# Each HARD entry is "<label>|<extended regex>", matched case-insensitively.
#
# The generation-credit rule is anchored on a word boundary on purpose, so
# ordinary prose such as "screenshots regenerated with the new identity" is not
# caught by the substring.
HARD_RULES=(
  "attribution trailer|^[[:space:]]*co-authored[ -]by:.*(anthropic\.com|claude|chatgpt|copilot|openai|gemini|codeium|gpt-[0-9])"
  "session trailer|^[[:space:]]*[a-z][a-z0-9_-]*-session:[[:space:]]*(https?://)?[^[:space:]]"
  "tool session URL|(claude\.ai/code|chat\.openai\.com|chatgpt\.com|copilot\.microsoft\.com|gemini\.google\.com|codeium\.com|cursor\.(com|sh))"
  "generation credit|(^|[^[:alnum:]])(generated with|co-authored by)[[:space:]]"
)

SOFT_PATTERN='(^|[^[:alnum:]-])(claude|chatgpt|copilot|gpt-[0-9]|cursor|codeium|gemini|anthropic|openai)([^[:alnum:]-]|$)'

# --- presentation ------------------------------------------------------------
RED=''; YLW=''; BLD=''; OFF=''
if [ -t 2 ]; then
  RED=$(printf '\033[31m'); YLW=$(printf '\033[33m')
  BLD=$(printf '\033[1m');  OFF=$(printf '\033[0m')
fi
in_ci() { [ -n "${GITHUB_ACTIONS:-}" ]; }

hard_hits=0
soft_hits=0

# scan_text <label> <file>
# Reports every rule that matches the file. Returns 1 if a HARD rule matched.
scan_text() {
  local label="$1" file="$2"
  local rule name pat hits hit lineno text local_hard=0

  for rule in "${HARD_RULES[@]}"; do
    name="${rule%%|*}"
    pat="${rule#*|}"
    hits=$(grep -nEi -- "$pat" "$file" 2>/dev/null)
    [ -n "$hits" ] || continue
    local_hard=1
    while IFS= read -r hit; do
      [ -n "$hit" ] || continue
      lineno="${hit%%:*}"
      text="${hit#*:}"
      printf '%s  %s  line %s  [%s]%s\n' "$RED" "$label" "$lineno" "$name" "$OFF" >&2
      printf '        %s\n' "$text" >&2
      in_ci && echo "::error::${label} line ${lineno}: ${name} — ${text}"
    done <<< "$hits"
  done

  # A message that already failed a HARD rule needs no notices: the same lines
  # would simply be listed twice.
  hits=''
  [ "$local_hard" -eq 0 ] && hits=$(grep -nEi -- "$SOFT_PATTERN" "$file" 2>/dev/null)
  if [ -n "$hits" ]; then
    while IFS= read -r hit; do
      [ -n "$hit" ] || continue
      lineno="${hit%%:*}"
      text="${hit#*:}"
      soft_hits=$((soft_hits + 1))
      printf '%s  %s  line %s  [notice]%s  %s\n' "$YLW" "$label" "$lineno" "$OFF" "$text" >&2
      in_ci && echo "::warning::${label} line ${lineno}: vendor or tool name in free text — ${text}"
    done <<< "$hits"
  fi

  return "$local_hard"
}

# Blank out what git itself discards — comment lines, and everything below the
# `git commit -v` scissors line — while keeping the original line numbering so
# the report points at the line the author actually sees.
strip_commentary() {
  awk '
    /^#[[:space:]]*-+[[:space:]]*>8[[:space:]]*-+/ { cut = 1 }
    cut  { print ""; next }
    /^#/ { print ""; next }
         { print }
  ' "$1"
}

# --- mode dispatch -----------------------------------------------------------
mode="${1:-}"
arg="${2:-}"
tmp=$(mktemp) || exit 0
trap 'rm -f "$tmp"' EXIT

case "$mode" in
  --message-file)
    [ -n "$arg" ] && [ -f "$arg" ] || exit 0
    strip_commentary "$arg" > "$tmp"
    scan_text "commit message" "$tmp" || hard_hits=1
    ;;

  --range|--all)
    if [ "$mode" = "--all" ]; then
      log_args=(--all)
    else
      [ -n "$arg" ] || { echo "usage: $0 --range <rev>..<rev>" >&2; exit 2; }
      log_args=("$arg")
    fi

    # One `git log` pass for the whole range, NUL-separated, rather than a
    # `git log` plus a `git rev-parse` per commit: on a long range the process
    # spawns dominate the runtime.
    count=0
    while IFS= read -r -d '' rec; do
      # git separates entries with a newline, so every record after the first
      # arrives with a leading one. Left in place it would empty the sha and
      # shift every reported line number by one.
      rec="${rec#$'\n'}"
      [ -n "$rec" ] || continue
      count=$((count + 1))
      printf '%s\n' "${rec#*$'\n'}" > "$tmp"
      scan_text "commit ${rec%%$'\n'*}" "$tmp" || hard_hits=1
    done < <(git log --format="%h%n%B%x00" "${log_args[@]}" 2>/dev/null)
    echo "Scanned ${count} commit message(s)."
    ;;

  *)
    echo "usage: $0 --message-file <path> | --range <rev>..<rev> | --all" >&2
    exit 2
    ;;
esac

# --- verdict -----------------------------------------------------------------
if [ "$hard_hits" -ne 0 ]; then
  printf '\n%sRejected: an attribution line was found.%s\n\n' "$BLD$RED" "$OFF" >&2
  printf 'How to fix:\n' >&2
  printf '  1. Remove the offending line(s) from the commit message.\n' >&2
  printf '  2. For a message being written now, re-run the commit.\n' >&2
  printf '     For a message already committed, reword it:\n' >&2
  printf '       git rebase -i <commit>~1     (then: reword)\n' >&2
  printf '  3. A trailer naming a real person with their address is fine —\n' >&2
  printf '     spell it out so it no longer matches a tool signature.\n\n' >&2
  exit 1
fi

if [ "$soft_hits" -ne 0 ]; then
  if [ "${COMMIT_MSG_STRICT:-0}" = "1" ]; then
    printf '\n%sRejected: COMMIT_MSG_STRICT=1 treats the notices above as errors.%s\n\n' "$BLD$RED" "$OFF" >&2
    exit 1
  fi
  printf '\n%s%d notice(s) above are not blocking.%s A dependency coordinate or a\n' "$YLW" "$soft_hits" "$OFF" >&2
  printf 'feature that genuinely names the vendor is expected here.\n\n' >&2
fi

exit 0
