Generate a filled GitHub pull request description based on what this branch introduces compared to main.

Run the following shell commands to gather context, then use the results to fill in the PR template below. Replace all HTML comments and placeholders with real content inferred from the diff. Keep all checkboxes unchecked — the author will check them.

```bash
git diff main...HEAD
git diff --stat main...HEAD
git log main..HEAD --oneline
git branch --show-current
```

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

Wrap the entire filled template inside a single fenced code block (``` ``` ```) with no language tag, so the raw markdown syntax (##, - [ ], etc.) is visible and copyable. No preamble, no explanation outside the code block.
