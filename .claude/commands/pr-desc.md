Generate a GitHub pull request title and a filled description based on what this branch introduces compared to main.

Run the following shell commands to gather context, then use the results to fill in the PR template below. Replace all HTML comments and placeholders with real content inferred from the diff. Keep all checkboxes unchecked — the author will check them.

```bash
git branch --show-current
git log origin/dev..HEAD --oneline
git diff origin/dev...HEAD --stat
git diff origin/dev...HEAD
```

If `git log origin/dev..HEAD` returns nothing (everything is already pushed), fall back to:

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Only describe the changes from the commits shown — do not include changes from commits already pushed to `origin/dev` or already on `main`.

## Title

PRs are squash-merged, so the title becomes the commit on `main`, the changelog entry, and the release-please version bump. CI rejects any title that doesn't match the rules in `scripts/commit-message-utils.mjs`:

- Format: `<type>(<scope>): <description>` or `<type>: <description>`; add `!` before the colon for a breaking change
- Type: one of `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `test`, `style`, `build`, `ci`, `revert`
- Scope (optional): lowercase, only `a-z 0-9 . _ / -`
- Description: 72 characters or fewer, lowercase start, imperative mood, no trailing period

Pick the type for the branch as a whole: `feat` if any commit adds user-facing functionality, else `fix` if any commit fixes a bug, else the type that best fits the rest. Use a scope only when every change falls in one area; otherwise leave it out. The description should cover the whole branch, not only its last commit.

Validate the title before printing it, and revise until it passes:

```bash
npm run lint:commit-msg -- --message "<title>" --source "pull request title"
```

## Description

Fill this template. For checkboxes, apply this logic:
- `[x]` = this is true / applies / was done
- `[ ]` = this does not apply or cannot be confirmed

Rules per section:
- **Type of change**: check all types that apply based on the diff (can be multiple)
- **Testing**: assume the author tested their own work — check all testing items unless there's a clear reason not to (e.g. no tests added/updated → leave that one unchecked)
- **UI changes**: if diff touches `webview-ui/`, uncheck "No UI changes" and check the design system items; if no webview changes, check "No UI changes" and leave the rest unchecked
- **Checklist**: check "follows conventions" and "read CONTRIBUTING" by default; check "no console.log" only if the diff contains no `console.log` lines; check "no new dependencies" only if no new deps were added

## Summary

Closes #

## Changes

-

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Improvement / refactor
- [ ] Documentation
- [ ] Chore / dependency update

## Testing

- [ ] Tested in Extension Development Host (F5)
- [ ] Verified existing functionality is not broken
- [ ] Added/updated tests (if applicable)

## UI changes

- [ ] No UI changes in this PR
- [ ] Follows the design system (VS Code CSS variables, no hardcoded colors, no external UI libs) — run `/ui-patterns` for reference
- [ ] Tested on both dark and light VS Code themes

## Checklist

- [ ] My code follows the project's coding conventions
- [ ] I have read the [CONTRIBUTING guide](../CONTRIBUTING.md)
- [ ] No new dependencies added without discussion
- [ ] No `console.log` or debug statements left in

## Output

Print exactly two fenced code blocks (``` ``` ```) with no language tag, so each can be copied on its own:

1. The PR title, on a single line.
2. The entire filled template, so the raw markdown syntax (##, - [ ], etc.) is visible and copyable.

Put a `**Title**` label line before the first block and a `**Description**` label line before the second. No other preamble or explanation.
