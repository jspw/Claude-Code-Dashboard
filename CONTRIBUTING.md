# Contributing to Claude Code Dashboard

Thanks for your interest in contributing! This document covers everything you need to get started.

---

## Table of contents

- [Contributing to Claude Code Dashboard](#contributing-to-claude-code-dashboard)
  - [Table of contents](#table-of-contents)
  - [Code of conduct](#code-of-conduct)
  - [Ways to contribute](#ways-to-contribute)
  - [Development setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [First-time setup](#first-time-setup)
    - [Running in development](#running-in-development)
    - [Building for release](#building-for-release)
  - [Project structure](#project-structure)
  - [Making changes](#making-changes)
    - [Branch naming](#branch-naming)
  - [Pull request requirements](#pull-request-requirements)
  - [UI/design guidelines](#uidesign-guidelines)
  - [Commit style](#commit-style)
  - [Questions?](#questions)

---

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report unacceptable behavior to the maintainers via a GitHub issue marked `[private]` or by emailing the repository owner.

---

## Ways to contribute

- **Bug reports** — open an issue using the Bug Report template
- **Feature requests** — open an issue using the Feature Request template
- **Bug fixes** — pick an issue labelled `bug` or `good first issue` and submit a PR
- **New features** — comment on the feature request issue first to align before writing code
- **Documentation** — typos, outdated info, unclear explanations are always welcome fixes

---

## Development setup

### Prerequisites

- Node.js 18+
- VS Code 1.85+
- `@vscode/vsce` if you want to package locally: `npm install -g @vscode/vsce`

### First-time setup

```bash
git clone https://github.com/jspw/Claude-Code-Dashboard.git
cd Claude-Code-Dashboard

# Install extension host dependencies
npm install

# Install webview UI dependencies
cd webview-ui && npm install && cd ..

# Build everything once
npm run build
```

### Running in development

```bash
# Terminal 1 — watch extension host
npm run watch:ext

# Terminal 2 — watch React UI
npm run watch:ui

# In VS Code — press F5 to open the Extension Development Host
# After making changes, press Cmd+R (Ctrl+R on Windows/Linux) to reload
```

### Building for release

```bash
don't worry about this — the CI pipeline handles it automatically when you merge to main
```

---

## Project structure

```
src/                  # Extension host (Node.js / VS Code API)
webview-ui/src/       # React UI (runs in webview sandbox)
  views/              # Top-level view components
  components/         # Shared UI components
webview-ui/dist/      # Built UI (loaded by extension at runtime)
dist/                 # Built extension host
.github/              # Issue templates, PR template, workflows
```

Changes to `src/` affect the extension host — rebuild with `npm run build:ext`.
Changes to `webview-ui/src/` affect the UI — rebuild with `npm run build:ui`.

---

## Making changes

1. **Fork** the repository and create a branch from `dev`:
   ```bash
   git checkout -b fix/my-bug-fix
   # or
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** Keep each PR focused on one thing.

3. **Test manually** in the Extension Development Host (F5).

4. **Check for regressions** — open the dashboard, navigate around, verify nothing is broken.

5. **Submit a pull request** against `dev` using the PR template.

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| Bug fix | `fix/<short-description>` | `fix/session-cost-overflow` |
| New feature | `feat/<short-description>` | `feat/export-csv` |
| Refactor | `refactor/<short-description>` | `refactor/token-parser` |
| Docs | `docs/<short-description>` | `docs/hooks-setup` |
| Chore | `chore/<short-description>` | `chore/update-deps` |

---

## Pull request requirements

All PRs must:

- [ ] Target the `dev` branch (feature/fix PRs go to `dev`; `dev` → `main` is batched by maintainers)
- [ ] Pass CI (build must succeed — no TypeScript errors)
- [ ] Include a clear description of what changed and why. Include screenshots for UI changes.
- [ ] Reference the related issue if one exists (`Closes #123`)
- [ ] Not introduce new external dependencies without prior discussion
- [ ] Use a conventional commit message (`feat:`, `fix:`, `chore:`, etc.) — this drives the automated changelog

UI PRs additionally must:

- [ ] Follow the [ui/ux design patterns](#uidesign-guidelines)
- [ ] Be tested on both a dark and a light VS Code theme
- [ ] Not add hardcoded colors, `rounded-xl+`, `shadow-*`, or external UI libraries

PRs that fail CI, have no description, or add undiscussed dependencies will not be reviewed until fixed.

---

## UI/design guidelines

The dashboard UI has a strict design system to stay visually consistent across all VS Code themes.

**Short version:**
- Tailwind CSS only — no custom CSS classes
- All colors via VS Code CSS variables (`var(--vscode-*)`) — no hardcoded hex values
- Tailwind accent colors for semantic status only (green = success, yellow = warning, blue = info, red = error)
- No external UI component libraries (no shadcn, MUI, Radix)
- No icon libraries — inline SVG only (12×12 or 14×14, `fill="currentColor"`)
- No `rounded-xl` or larger; no `shadow-*`

For the **full reference** (all button patterns, icon SVGs, chart color palettes, typography scale, layout patterns), run `/ui-patterns` in a Claude Code session inside this repo. Read [commands](.claude/commands/ui-patterns.md) for instructions.

---

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `docs` | Documentation only |
| `chore` | Build, deps, config |
| `style` | Formatting, whitespace |

Examples:
```
feat(dashboard): add weekly token comparison to overview tab
fix(parser): handle sessions with missing model field
docs: update hooks setup instructions in README
chore: bump vsce to 2.24
```

Keep the subject line under 72 characters. Use the body for the "why" when needed.

---

## Releasing a new version

> This is for maintainers only.

Releases are fully automated via [`release-please`](https://github.com/googleapis/release-please). **Do not manually bump versions, edit `CHANGELOG.md`, or create tags.**

### How it works

1. Every push to `main` triggers the Release Please workflow.
2. The bot reads conventional commit messages and keeps a **Release PR** open, accumulating all pending changes. It auto-bumps `package.json` version and updates `CHANGELOG.md` following semver rules:
   - `fix:` commits → patch bump
   - `feat:` commits → minor bump
   - `feat!:` or `BREAKING CHANGE:` footer → major bump
3. When you're ready to ship, **merge the Release PR**. The bot creates a GitHub Release and tag automatically.
4. When Release Please creates a GitHub Release, the same workflow immediately runs the publish job and publishes to both VS Code Marketplace and Open VSX.

### Summary

- No manual version bumps
- No manual tagging
- No manual `CHANGELOG.md` edits
- Just merge the Release PR when ready to publish

---

## Questions?

Open a [GitHub Discussion](https://github.com/jspw/Claude-Code-Dashboard/discussions) for anything that doesn't fit a bug report or feature request.
