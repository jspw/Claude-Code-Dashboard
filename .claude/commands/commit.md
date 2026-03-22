Generate a conventional commit message based on the current staged and unstaged changes, then commit them.

First, run these to understand what changed:

```bash
git diff HEAD
git diff --stat HEAD
git status --short
```

Then generate a commit message following the Conventional Commits spec:

```
<type>(<optional scope>): <short summary>

<optional body — only if the change needs explanation beyond the summary>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that is neither a fix nor a feature
- `perf` — performance improvement
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — build, deps, config, tooling
- `ci` — CI/CD changes

**Rules:**
- Summary line: lowercase, no period, max 72 chars
- Scope: the affected area e.g. `release`, `sidebar`, `ci`, `webview`
- Body: wrap at 72 chars, explain *why* not *what*
- If it's a breaking change, add `!` after the type and a `BREAKING CHANGE:` footer

After showing the commit message, ask the user to confirm before running:

```bash
git add -A && git commit -m "<the generated message>"
```
