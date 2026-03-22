Generate a filled GitHub pull request description based on what this branch introduces compared to main.

Run the following shell commands to gather context, then use the results to fill in the PR template below. Replace all HTML comments and placeholders with real content inferred from the diff. Keep all checkboxes unchecked — the author will check them.

```bash
git diff main...HEAD
git diff --stat main...HEAD
git log main..HEAD --oneline
git branch --show-current
```

Fill this template:

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

Output only the filled template, nothing else.
