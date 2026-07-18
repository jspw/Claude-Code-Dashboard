# Claude Code Dashboard — Product Document

## What It Is

Claude Code Dashboard is a VS Code extension that turns the raw session data Claude Code writes to `~/.claude/` into a living analytics layer for developers. Every time you run a Claude session — asking it to fix a bug, build a feature, refactor a module — Claude records the conversation in a JSONL file on disk. The dashboard reads those files and surfaces the things developers actually want to know: what is my token usage today, what is my estimated spend, which sessions seem most expensive, which files does Claude keep touching, how efficient are my prompts, and is Claude running right now?

It is not a SaaS product. It does not send any data anywhere. It reads files that already exist on your machine and presents them inside VS Code.

---

## The Problem It Solves

Developers using Claude Code extensively have a visibility problem. The CLI tells you tokens used per turn, but nothing across sessions, projects, or time. You do not know:

- How much you spent this week across all projects
- Which project is consuming the most tokens
- Whether your prompting style is efficient or wasteful
- What time of day you are most productive with Claude
- Which files Claude touches most (your "hot files")
- Whether a session from two days ago is still somehow running

The data to answer all of these questions is sitting in `~/.claude/projects/` — it just has never been visualised.

---

## Who It Is For

**Primary user:** A developer who uses Claude Code every day across multiple projects and wants visibility into their usage, estimated costs, and patterns. They are comfortable with VS Code extensions and are not looking for a web dashboard — they want this information where they already work.

**Secondary user:** A team lead or freelancer who wants project-level usage allocation for AI-assisted work and needs a fast local approximation of which projects consumed what. This is operational visibility, not billing-grade reporting.

---

## Core Value Propositions

### 1. Cost awareness in real time
The status bar shows today's token count and estimated dollar cost at a glance, updated whenever a session file changes. No waiting for a monthly bill. You get a fast local approximation of spend before you close your laptop.

### 2. Session-level accountability
Every session is a record: when it started, how long it ran, how many prompts it took, which files it touched, and exactly what the first prompt was. The session summary line (the first user prompt shown as a preview) answers "what was I doing in this session?" without having to open it.

### 3. Pattern recognition over time
The dashboard accumulates data across weeks and months. You start to see: I am most productive on Tuesday mornings. I use the Bash tool 40% of the time. My most expensive sessions are the ones where I write large features in a single sitting. This is information you cannot get from the CLI.

### 4. Budget guardrails
Set a monthly USD budget. Get warned at 80% and again at 100%. The alert fires in VS Code's notification system — you do not have to remember to check.

### 5. True active session detection
Knowing whether Claude is actually running right now (not just "was active 20 minutes ago") is useful. The extension reads `~/.claude/sessions/` where Claude writes a metadata file with a PID for each running session. A live process check tells you with certainty whether Claude is thinking right now.

---

## Feature Inventory

### Status Bar
- Compact by default: active-session count + today's estimated cost (`✱ 3 · $4.32`). `full` mode adds a label and today's tokens; `off` hides it (setting `claudeDashboard.statusBar`).
- Rich markdown tooltip: today's tokens/cost, project/active counts, and a budget line when a budget is set.
- Turns amber (`statusBarItem.warningBackground`) once monthly spend passes 80% of budget — the always-visible guardrail.
- Clicks open the full dashboard.

### Sidebar (Activity Bar)
- Rebuilt on the shared Tailwind/VS Code-variable system (no more private inline styles).
- Project list grouped into: Active / Recent (last 7 days) / Older, collapsible.
- Each row shows a second line: relative last-active time · tokens · estimated cost; a hover button reveals the folder in the OS.
- Single click opens the project detail view; a "View Dashboard" button opens the full dashboard.

### Dashboard — Home Tab
- Optional first-run welcome strip (local-only / cost-estimate / enable-live-tracking), dismissible.
- Full-screen empty state when no `~/.claude` data exists yet, with a Refresh action.
- Budget: a progress bar whenever a budget is set, a banner at ≥80%, and an inline "Set a monthly budget" affordance that writes the VS Code setting.
- Weekly recap card: sessions, projects, tokens, estimated cost, files modified, top project, streak.
- Stats strip: tokens today / estimated cost today / tokens this week / estimated cost this week.
- Active project cards with live pulse animation.
- Filterable, sortable project list with honest truncation ("Show all N" past 20).

### Dashboard — Analytics Tab
- A single tab that merges the former Charts and Insights, with a 7 / 30 / 90-day range control applied to the usage chart (its title names the active range).
- Spend: token usage line, usage by project, projected monthly cost with progress bar.
- Patterns: prompt categories, usage heatmap by hour/day, productivity by hour.
- Efficiency: avg tokens per prompt, avg tool calls per session, avg session duration, first-turn resolution rate.
- Tools & files: tool usage breakdown, hot files (15 most-edited), recent file changes (last 7 days).

### Dashboard — Sessions Tab
- The promised cross-project browser: every session across all projects, sortable (recent / most expensive / most tokens) and filterable by project and model.
- "Most expensive this month" quick filter — answers the #1 cost question directly.
- Full-text prompt search, **backend-served** (`searchPrompts` → `promptSearchResults`), with highlighted matches. No prompt corpus is shipped in the dashboard payload.
- Clicking a session or a search hit opens the owning project with that session pre-selected.

### Project Detail View — 5 tabs
- Header: name, live indicator, tech-stack badges, path (click reveals the folder), single Export dropdown (JSON / CSV).
- **Overview**: stat cards (tokens, estimated cost, sessions, last active), the 3 most recent sessions, and quick links into the other tabs.
- **Sessions**: day-grouped list titled by the first prompt (with model/thinking SVG chips and a second metadata line), a filter box, a Subagents toggle that nests delegated runs, and the turn-by-turn detail pane. The detail header includes a one-click "copy resume command" (`claude --resume <id>`).
- **Activity**: usage trend, files touched (each opens in the editor), tool usage + recent calls, and Claude co-authored commits.
- **Setup**: CLAUDE.md, memory (index + referenced files), custom commands, MCP servers, and automation (hooks + project settings).
- **Work**: plans and todos — the tab is hidden entirely when both are empty.

### Alert System
- Monthly token budget: alert when monthly token count exceeds configured limit
- Monthly estimated cost budget: alert at 80% and 100% of configured USD amount
- Weekly digest: Monday morning recap (sessions, projects, tokens, top project)
- All alerts fire as VS Code notifications; max once per day to avoid spam

### Real-Time Hook System
- On first activation, asks once whether to enable live tracking (Enable / Not now / Never). Any explicit choice is persisted — the dialog never re-asks.
- With consent, injects `PostToolUse` and `Stop` hooks into `~/.claude/settings.json` (backup saved first). Hooks append events to `~/.claude/.dashboard-events.jsonl`.
- Injected hooks are armed by a `~/.claude/.dashboard-live` marker file and no-op without it, so stale hook entries can never write events.
- Toggle anytime via the `Enable Live Tracking` / `Disable Live Tracking` commands; disabling strips the hooks from settings.json. Uninstalling the extension runs a cleanup script that removes the hooks, marker, and event file.
- EventWatcher polls the event file every 500ms and pushes live events to the React frontend, enabling "Claude is using the Bash tool right now" visibility

---

## Data It Reads (All Local, All Read-Only)

| Path | Purpose |
|---|---|
| `~/.claude/projects/<id>/*.jsonl` | Session conversation files |
| `~/.claude/projects/<id>/subagents/*.jsonl` | Subagent session files |
| `~/.claude/sessions/` | Live session metadata (pid, sessionId, cwd) |
| `~/.claude/settings.json` | Global Claude settings and MCP server config |
| `~/.claude/.dashboard-events.jsonl` | Live hook events (created by extension) |
| `~/.claude/.dashboard-live` | Marker that arms the injected hooks (created/removed by extension) |
| `<project>/.claude/settings.local.json` | Per-project MCP and settings |
| `<project>/CLAUDE.md` | Project instructions |

The extension never writes to any of these files except `settings.json` (to inject hooks, only with user consent) and `.dashboard-events.jsonl` (created by the injected hooks).

---

## Token And Cost Semantics

- Token counts come from Claude's local JSONL session logs.
- Displayed `totalTokens` exclude cache-read tokens, because cache reads can dwarf the meaningful token count in long sessions.
- Estimated cost is computed locally from parsed token usage, detected model family, and a static pricing table bundled with the extension.
- Model detection maps the recorded model ID to a pricing family (Fable/Mythos, current Opus, legacy Opus 4.0/4.1, Sonnet, Haiku 4.5, legacy Haiku). Unknown models fall back to Sonnet pricing and the session is marked `est.*` in the UI (`pricingConfidence: 'fallback'`).
- The bundled pricing table records its last-updated date (2026-06), shown in the cost disclaimer.
- Aggregate estimated cost includes subagent-attributed cost when Claude spawns subagents.
- These numbers are helpful operational estimates, but they are not guaranteed to match Anthropic billing, invoices, or future price changes exactly.

---

## What It Does Not Do

- It does not intercept Claude's network calls or modify Claude's behaviour.
- It does not store data in a database or send it to any server.
- It does not require an API key.
- It does not work if you do not have Claude Code installed (`~/.claude/` must exist).
- It shows sessions from before installation too — historical JSONL files in `~/.claude/projects/` are parsed on first load, so past sessions are visible retroactively.

---

## Roadmap (Not Yet Implemented)

These are identified improvements that have not been built yet:

**High priority**
- Session diff viewer using `~/.claude/file-history/` — show what Claude actually changed in each session, split-pane before/after
- Git correlation — read `.git/log` from the project path and link Claude sessions to git commits made within 10 minutes
- Prompt library — star/save prompts; auto-detect frequently repeated patterns across sessions

**Medium priority**
- Project health score — synthetic 0-100 score based on session frequency, token efficiency, file churn, first-turn resolution rate
- Session replay timeline — visual horizontal track of tool calls with timing ("Claude spent 40s on Read calls")
- Outstanding TODOs across projects — read `~/.claude/todos/` and `~/.claude/tasks/` per session

**Nice to have**
- Team/shared mode — aggregate multiple users' sessions into one view
- Notification on session completion — "Claude finished your session in project X"
- VS Code theme integration improvements for dark/light mode

---

## Non-Goals (Intentionally Out of Scope)

- Modifying how Claude behaves or inserting prompts
- A web-based or mobile version
- Multi-machine sync
- Billing integration or invoice generation
- Real-time collaboration or shared dashboards
