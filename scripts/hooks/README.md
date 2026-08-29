# Git hooks

Versioned hooks for this repository. `.git/hooks/` is not cloned, so these live
here instead and are pointed at with a one-time config setting.

## Enable (once per clone)

```bash
git config core.hooksPath scripts/hooks
```

Verify it took:

```bash
git config --get core.hooksPath   # -> scripts/hooks
```

## `commit-msg`

Keeps automatically added attribution lines out of the history. It reports the
offending line number, the rule that matched, and how to fix it.

The hook is only a thin entry point: the rules live in
[`scripts/check-commit-messages.sh`](../check-commit-messages.sh), which the
`Repo hygiene` workflow also runs over the commits a push or pull request adds.
`core.hooksPath` is local config and is not cloned, so a commit made on another
machine, in a fresh checkout, or with `--no-verify` would otherwise go
unchecked. One script, one set of rules, so the local and the remote check
cannot drift apart.

### Rejected outright

Machine-appended shapes that do not occur in prose written by hand:

| Rule | Matches |
|---|---|
| `attribution trailer` | a `Co-authored-by:` trailer naming a tool or vendor rather than a person |
| `session trailer` | any `*-Session:` trailer carrying a URL |
| `tool session URL` | a link to a tool's session or workspace |
| `generation credit` | a `generated with` / `co-authored by` credit line |

A `Co-authored-by:` trailer naming a real person with their address passes
normally — only tool signatures are rejected.

### Reported, not blocking

A tool or vendor name appearing in free text is printed as a notice and the
commit proceeds. This is deliberate: the backend ships a summarisation feature
and takes dependency bumps whose coordinates legitimately contain the same
names — `com.anthropic:anthropic-java` is a real dependency of this project, and
Dependabot's generated bodies name it several times. Rejecting those would block
routine automated maintenance for no benefit.

To treat notices as errors for a single commit:

```bash
COMMIT_MSG_STRICT=1 git commit ...
```

### Bypassing

```bash
git commit --no-verify
```

Reserve it for cases where the hook is genuinely wrong, and prefer rewording the
message. CI runs the same check on push, so a bypass is visible rather than
final.

## Running the check by hand

```bash
bash scripts/check-commit-messages.sh --message-file .git/COMMIT_EDITMSG
bash scripts/check-commit-messages.sh --range main..HEAD
bash scripts/check-commit-messages.sh --all
```

## Notes

- Only the commit message is read. Comment lines and the diff that
  `git commit -v` appends below the scissors line are ignored, so text quoted
  from a patch never trips it.
- The hook is POSIX `sh`; the shared script is `bash` and needs nothing beyond
  `git`, `grep`, `awk` and `mktemp`.
- If the shared script is missing from a checkout the hook says so and lets the
  commit through, rather than blocking all work — CI still covers it.
