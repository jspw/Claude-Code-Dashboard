## Summary

<!-- Briefly describe what this PR changes and why. Link the related issue if one exists. -->

Closes #

## Changes

<!-- List the key changes made. Be specific enough that a reviewer knows where to look. -->

-

## Type of change

<!-- Check all that apply -->

- [ ] Bug fix
- [ ] New feature
- [ ] Improvement / refactor
- [ ] Documentation
- [ ] Chore / dependency update

## Commit / PR title

<!--
Use Conventional Commits. The PR title should match the final squash/rebase title.
Examples:
- feat(dashboard): add weekly token comparison
- fix(parser): handle missing session metadata
- docs: update release workflow notes
- chore(ci): enforce conventional commit messages
-->

- [ ] PR title follows Conventional Commits (`type(scope): description` or `type: description`)
- [ ] All commit messages in this PR follow Conventional Commits

## Testing

<!-- Describe how you tested this change. -->

- [ ] Tested in Extension Development Host (F5)
- [ ] Verified existing functionality is not broken
- [ ] Added/updated tests (if applicable)

## UI changes

<!-- If this PR touches the webview UI, confirm the following: -->

- [ ] No UI changes in this PR
- [ ] Follows the design system (VS Code CSS variables, no hardcoded colors, no external UI libs) — run `/ui-patterns` for reference
- [ ] Tested on both dark and light VS Code themes

## Checklist

- [ ] This PR targets `dev` (feature/fix work should not target `main`)
- [ ] My code follows the project's coding conventions
- [ ] I have read the [CONTRIBUTING guide](../CONTRIBUTING.md)
- [ ] No new dependencies added without discussion
- [ ] No `console.log` or debug statements left in
- [ ] If this PR will be merged to `main`, it will use **Squash and merge** or **Rebase and merge** instead of **Create a merge commit**
