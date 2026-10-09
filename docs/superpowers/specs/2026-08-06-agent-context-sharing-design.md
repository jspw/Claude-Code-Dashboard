# Agent Context Sharing — Design

**Date:** 2026-08-06
**Status:** Approved for planning

## Problem

Claude Code accumulates durable project knowledge in `~/.claude/`: memory files,
session transcripts, custom commands, MCP configuration, hooks. All of it lives
outside the repository. When another coding agent — Codex, Cursor — works on the
same project, none of that knowledge is reachable. The agent starts from zero.

Transport is the gap. The knowledge is already curated; it is simply in a
location no other tool reads.

## Goals

- Emit an `AGENTS.md` that other agents load automatically, derived from existing
  project configuration and memory.
- Emit prior session history in a form another agent can navigate on demand.
- Support two scopes: the whole project as files, and a single session as text on
  the clipboard, ready to paste into an agent that already knows the project.
- Contain no LLM call. The dashboard formats already-written material; it does
  not synthesize.

## Non-goals

- **No summarization.** Turning raw turns into prose requires a model. Where
  synthesis is needed, the receiving agent does it on demand.
- **No git operations.** Project scope writes files; staging, committing, and
  ignoring are the user's decisions. Session scope writes nothing at all.
- **No redaction or secret scanning.** The user controls what leaves their
  machine by choosing what to commit.
- **No Cursor/Copilot adapters in v1.** `AGENTS.md` is the cross-agent
  convention. Additional targets are a per-target render function later.
- **No sync.** Each invocation is a full regeneration.

## Constraint that shapes the design

Measured on the author's machine: `~/.claude/projects` holds 214 MB across 38
projects; the largest single project is 50 MB of JSONL — roughly 12M tokens,
well beyond any agent's context window.

Inlining transcripts is therefore impossible. The resolution: agents can read
files. `AGENTS.md` stays small and always-loaded; transcripts sit beside it as
individual files behind an index. The agent opens only what it needs. Volume
stops mattering because nothing is inlined, and the synthesis happens in the
receiving agent, where a model already exists.

## Architecture

Two scopes, two mechanisms — deliberately not one mechanism with a session filter.

Sharing a whole project means the other agent knows nothing yet, so the output is
a standing `AGENTS.md` bundle it loads by itself. Sharing one session means the
opposite: the agent is already working on this repository and only the
conversation is missing. Writing files for that case would be ceremony around
something the user wants to paste. So session scope renders chat-ready text
straight to the clipboard and touches no files at all.

### New module: `src/share/`

Pure. No `vscode` import. String in, string out.

| File | Export | Responsibility |
|---|---|---|
| `buildBundle.ts` | `buildBundle(project, config, sessions): BundleFile[]` | Assembles the complete file list |
| `renderAgentsMd.ts` | `renderAgentsMd(project, config, sessionCount): string` | Project config + memory → `AGENTS.md` |
| `renderTranscript.ts` | `renderTranscript(session, projectPath): string`, `renderTurns(turns, projectPath, labels)` | One `Session` → one transcript; the conversation itself, shared with the handoff renderer |
| `renderHandoff.ts` | `renderHandoff(project, session): string`, `estimateTokens(text)` | One `Session` → clipboard text |
| `renderIndex.ts` | `renderIndex(sessions, projectPath): string` | Session table |
| `types.ts` | `BundleFile` | `{ relativePath: string; content: string }` |

All domain types (`Project`, `Session`, `Turn`, `ToolCall`, `ProjectConfig`,
`MemoryFile`) are already exported from `src/store/DashboardStore.ts`. The module
imports them with `import type` so the dependency stays type-only.

Note that `modelLabel` lives in `webview-ui/src/components/SessionDetail.tsx` and
is not reachable from the backend. Transcript frontmatter carries the raw
`session.model` string; no helper is duplicated.

### The `vscode` boundary

`src/share/writeBundle.ts` is the only file in the module that imports `vscode`.
It takes `BundleFile[]` plus a root path, writes each via
`vscode.workspace.fs.writeFile`, and returns the written paths.

This split keeps every rendering decision unit-testable with plain fixtures, no
VS Code test harness. It mirrors `src/hooks/stripDashboardHooks.ts`, already
factored out as a pure helper shared with uninstall.

### Wiring

Follows the existing `exportSessions` path, which already performs writes.

- Command `claudeDashboard.shareContext` registered in `src/extension.ts`
  alongside `claudeDashboard.exportSessions`.
- Signature: `(projectId: string, scope: 'project' | 'session', sessionId?: string)`.
- `src/webviews/ProjectPanel.ts` handles
  `{ type: 'shareContext', scope, sessionId? }` and delegates to the command.

### Output layout

Written to the project root (`project.path`):

```
AGENTS.md
.agent-context/
  INDEX.md
  sessions/
    2026-08-06-redesign-session-timeline.md
```

A single folder holds everything except `AGENTS.md`, so excluding it from git is
one `.gitignore` line whenever the user wants that. The dot prefix keeps the repo
root uncluttered; agents read hidden directories without trouble.

Transcript filenames are `YYYY-MM-DD-<slug>.md`, where the slug derives from
`sessionSummary` (lowercased, non-alphanumerics collapsed to hyphens, truncated
to 60 characters). When `sessionSummary` is null or slugifies to an empty string,
the slug is the first 8 characters of `session.id`. Collisions within a single
bundle get a `-2`, `-3` suffix.

Only project scope writes anything, so a bundle always describes the whole project
and `INDEX.md` always covers every transcript beside it. An earlier draft filtered
one shared code path by scope, which meant a single-session export regenerated
`INDEX.md` from one session and destroyed the index built by an earlier full
export. Splitting the two mechanisms removes that class of bug rather than
guarding against it.

## File formats

### `AGENTS.md`

Sections are omitted entirely when their source data is empty.

`CLAUDE.md` gets a blockquote attribution rather than a `##` wrapper: it usually
opens with its own `#` heading, which would outrank any wrapper we put above it,
and demoting its headings would mean rewriting text inside fenced code blocks. A
horizontal rule closes the verbatim block before the generated sections start.

```markdown
# <project.name>

<!-- Generated by Claude Code Dashboard · <ISO date> · regenerate to refresh -->

> Project instructions, copied verbatim from `CLAUDE.md`.

<config.claudeMd verbatim>

---

## Working knowledge
Facts recorded during prior sessions.

### <Type, title-cased>
- **<memory.name>** — <memory.description>
  <memory.content>

## Plans
- **<plan.name>** — <plan.description>

## Custom commands
- `/<command.name>` — <description>

## MCP servers
| Server | Transport |
|---|---|
| <name> | <type or "stdio"> |

## Automation
| Event | Matcher | Command |
|---|---|---|

## Prior session history
<N> sessions indexed at `.agent-context/INDEX.md`. Open the relevant file when
you need background on a specific area — don't read them all.
```

Details:

- Memory entries are grouped by `MemoryFile.type` (`user`, `feedback`,
  `project`, `reference`), each group under a title-cased heading, groups in that
  fixed order with unknown types last.
- Each entry renders name, description, **and body**. Memory bodies are one fact
  each by design, so the total stays in the kilobytes, and the receiving agent
  gets the reasoning rather than only a headline.
- `[[wikilink]]` references inside memory bodies are rewritten to the linked
  memory's plain display name. The syntax is Claude-Code-specific and meaningless
  to other agents.
- `ProjectConfig.commands` carries only `{ name, content }`. The renderer parses
  a `description:` from the command's YAML frontmatter, falling back to the first
  non-empty line of the body.

### Transcripts — `.agent-context/sessions/<slug>.md`

```markdown
---
session: <session.id>
date: <session.startTime>
model: <session.model, raw>
summary: <session.sessionSummary>
files: <project-relative filesModified + filesCreated, comma-separated>
---

## You
<user turn content>

## Claude
<assistant turn text>

- `Edit` webview-ui/src/components/conversation/ResponseGroup.tsx
- `Bash` npm test
```

Consecutive turns from the same speaker share one label: a single reply arrives
split across prose and tool calls, and re-labelling every fragment reads as a
stutter. Tool lines are list items because consecutive plain lines would collapse
into one paragraph.

Three content rules:

1. **Thinking blocks are dropped.** Internal reasoning, and often the bulk of the
   bytes.
2. **Tool calls render as a single line — tool name plus primary argument. Output
   is omitted entirely.** This is the decision that makes the feature viable.
   Tool output is the large majority of the volume and the least useful part to
   another agent, because the agent has the repository. It does not need a
   `Read` result from last week; it can read the file as it exists now. What it
   cannot reconstruct is what was asked and why — and that is exactly what
   survives. Measured against real projects: this repo's 1.3 MB of JSONL renders
   to 5.7%, and the 50 MB `planner` project — whose volume is dominated by tool
   output — renders to 0.5% (0.3 MB, 3 ms). The heavier a session is in tool
   traffic, the larger the reduction.
3. **Paths are project-relative**, consistent with the existing `conversation/`
   components.

Primary argument per tool: `file_path` when present, else `command`, else
`pattern`, else `path`, else omitted. Values longer than 120 characters are
truncated with an ellipsis. Absolute project paths embedded inside a command are
stripped to their relative form — they are noise to a reader who has the repo,
and they would carry a home directory into text handed to someone else.

Accepted tradeoff: dropping tool output loses "what did the test say". Stale test
output is misleading more often than useful. Capturing output for failed calls
only is a possible later addition.

### `INDEX.md`

Newest first:

```markdown
# Session history

| Date | Summary | Files touched | Transcript |
|---|---|---|---|
| 2026-08-06 | Redesign session timeline | `ResponseGroup.tsx`, … | [link](sessions/…md) |
```

Listing filenames in the table lets an agent grep the index for a file and jump
straight to the sessions that touched it. Files column is capped at five entries
with `+N more`.

### Session handoff — clipboard only

Not a file. This text goes into another agent's chat, so it is addressed to that
agent and carries its own framing:

```markdown
# Earlier session on <project.name>

Below is a conversation I had with another AI coding assistant (Claude Code) on this
same project. I am sharing it so you have the background: what I asked for, what was
tried, and why.

Two things to keep in mind. Tool results are not included, only the calls — so read the
files yourself rather than trusting anything here about their contents. And the code may
have changed since, so treat all of this as history, not as the current state.

- **When:** 2026-08-05 · 2h 14m
- **Topic:** <sessionSummary, flattened to one line, 120 chars>
- **Files touched:** `src/a.ts`, … (12 max, then "and N more")

---

**Me:**

<user turn content>

**Claude:**

<assistant turn text>

- `Edit` src/a.ts
```

Differences from the file transcript, all following from where the text lands:

- **No YAML frontmatter and no project configuration.** Frontmatter is file
  metadata, and the receiving agent already has the project — the conversation is
  the only missing piece.
- **Bold role labels, not headings.** A pasted `##` would compete with the
  structure of the conversation it is pasted into.
- **The summary is flattened to one line.** Real summaries are frequently the
  opening prompt verbatim, fenced code block and all, which would otherwise break
  out of the metadata list. Observed, not hypothetical.
- **A preamble stating that tool results are missing and the tree has moved on.**
  Without it the agent has no way to know either.

Measured on real sessions: 3.4–24.4 KB, roughly 850–6,200 tokens, including a
175-turn session. These paste comfortably. Above ~25k estimated tokens the
notification becomes a warning, since some chats will reject a message that long.

## UI

**Full project** — a "Share with other agents" section at the top of the Setup
tab in `webview-ui/src/views/ProjectDetail.tsx`, containing a short explanation
and an outline-style button per the project's button patterns.

**Single session** — a "Copy for another agent" button beside `ResumeButton` in
`webview-ui/src/components/SessionDetail.tsx`, styled to match it. Its label,
tooltip, and clipboard icon all say copy rather than share, because a button that
silently writes files into the repo when the user expected a copy is the kind of
surprise that makes a feature untrustworthy.

Both post `{ type: 'shareContext', scope, sessionId? }` through the existing
`vscode.ts` bridge. Icons are inline SVG at 12×12 with `fill="currentColor"`.

## Behavior and error handling

- **Existing `AGENTS.md`.** If the file exists, show a modal warning
  (`vscode.window.showWarningMessage` with `{ modal: true }`) offering Overwrite
  or Cancel. Hand-written `AGENTS.md` files are common; silent clobbering would
  be destructive. Files under `.agent-context/` are overwritten without
  prompting — they are wholly generated.
- **Progress.** Wrap generation in `vscode.window.withProgress`
  (`Notification` location). Full-project rendering on the largest project is a
  synchronous pass over data already in the store; it should take seconds, but
  must not appear frozen.
- **Completion.** `showInformationMessage` reporting the file count and root
  path, with a "Reveal" action calling `revealFileInOS`.
- **Missing project.** Command returns silently if `store.getProject(projectId)`
  is undefined, matching `exportSessions`.
- **Write failure.** Catch per-file, collect failures, and report them in a
  single `showErrorMessage` rather than aborting the batch.
- **Empty project.** A project with no CLAUDE.md, no memory, and no sessions
  still emits `AGENTS.md` with a header and whatever sections have data. No
  special-casing.
- **Session copy.** Writes to `vscode.env.clipboard` and reports the estimated
  token count, so the user knows before pasting whether it will fit. The offered
  action opens an *untitled* markdown document — reviewing or trimming the text
  never leaves a file behind, which is the whole point of this scope.
- **Missing session.** Warns and copies nothing.

## Testing

Matches existing conventions: Vitest, co-located `__tests__/`, fixtures under
`src/__tests__/fixtures/`. Coverage gate is 80% lines, 75% branches, 80%
functions.

**`src/share/__tests__/`** — the bulk of the value, all pure:

- `renderAgentsMd`: section omission when data is empty; memory grouping and type
  ordering; `[[wikilink]]` rewriting; command description from frontmatter and
  from first-line fallback; MCP and hook table rendering.
- `renderTranscript`: thinking dropped; tool output omitted; primary-argument
  selection across tool shapes; path relativization; frontmatter correctness;
  same-speaker runs sharing one label.
- `renderHandoff`: the preamble; chat labels rather than headings; metadata lines
  present and absent; multi-line summary flattening; duration formatting across
  its branches; token estimation.
- `renderIndex`: ordering, file-list capping, link correctness.
- `buildBundle`: every transcript it emits appears in the index; slug generation,
  the null-`sessionSummary` fallback, and collision suffixing.

**`writeBundle`** — mocked `vscode.workspace.fs`, asserting paths and the
per-file failure-collection path.

**Components** — RTL tests asserting the posted message payload for both
buttons.

Existing session fixtures in `src/__tests__/fixtures/sessions.ts` are extended
rather than duplicated.

## Future work

Deliberately deferred: Cursor and Copilot render targets; capturing output for
failed tool calls; incremental regeneration; a preview-before-write step.
