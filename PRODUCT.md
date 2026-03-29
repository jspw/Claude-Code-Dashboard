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
- Live token count and estimated cost for today
- Session count indicator (pulses when a session is active)
- Clicks open the full dashboard

### Sidebar (Activity Bar)
- Project list grouped into: Active Now / Recent (last 7 days) / All Projects
- Each project shows last-active time and live indicator
- Single click opens the project detail view
- Refresh button triggers a full re-scan

### Dashboard — Overview Tab
- Budget alert banner (yellow at 80%, red at 100%)
- Weekly recap card: sessions, projects, tokens, estimated cost, files modified, top project, streak
- Stats strip: tokens today / estimated cost today / tokens this week / estimated cost this week
- Active project cards with live pulse animation
- Filterable, sortable project list (filter by name; sort by last active, estimated cost, or session count)

### Dashboard — Charts Tab
- Token usage over the last 30 days (line chart)
- Token usage by project (bar chart)
- Projected monthly estimated cost with progress bar
- Estimated cost by project this month (horizontal bar chart)

### Dashboard — Search Tab
- Full-text search across every user prompt ever written
- Results show project name, session ID, and a highlighted snippet
- Searching "refactor auth" finds every time you asked Claude to do that across all projects

### Dashboard — Insights Tab
- Prompt category breakdown: Fix/Bug, Explain, Refactor, Feature, Test, Other
- Usage heatmap by hour and day of week
- Efficiency stats: avg tokens per prompt, avg tool calls per session, avg session duration, first-turn resolution rate
- Tool usage breakdown with percentage bars
- Productivity by hour (avg tool calls and files modified per session)
- Hot files: the 15 most-edited files across all sessions
- Recent file changes (last 7 days)

### Project Detail View
- Project header with tech stack badges, path, and live indicator
- Stats: total tokens, estimated cost, session count
- Sessions tab: chronological session list with:
  - Session summary line (first user prompt as italic preview)
  - Extended thinking badge (⚡) for sessions that used thinking mode
  - Duration, token count, prompt count
  - Subagent cost indicator when subagents were spawned
  - Session detail pane: full stats, files touched, turn-by-turn conversation
  - Cache hit rate and thinking token counts in session metadata
- CLAUDE.md tab: project instructions displayed verbatim
- MCP Servers tab: all configured MCP servers for the project with command/URL
- Export: JSON or CSV export of all session data

### Alert System
- Monthly token budget: alert when monthly token count exceeds configured limit
- Monthly estimated cost budget: alert at 80% and 100% of configured USD amount
- Weekly digest: Monday morning recap (sessions, projects, tokens, top project)
- All alerts fire as VS Code notifications; max once per day to avoid spam

### Real-Time Hook System
- On first activation, offers to inject `PostToolUse` and `Stop` hooks into `~/.claude/settings.json`
- Hooks append events to `~/.claude/.dashboard-events.jsonl`
- EventWatcher polls that file every 500ms and pushes live events to the React frontend
- Enables "Claude is using the Bash tool right now" visibility

---

## Data It Reads (All Local, All Read-Only)

| Path | Purpose |
|---|---|
| `~/.claude/projects/<id>/*.jsonl` | Session conversation files |
| `~/.claude/projects/<id>/subagents/*.jsonl` | Subagent session files |
| `~/.claude/sessions/` | Live session metadata (pid, sessionId, cwd) |
| `~/.claude/settings.json` | Global Claude settings and MCP server config |
| `~/.claude/.dashboard-events.jsonl` | Live hook events (created by extension) |
| `<project>/.claude/settings.local.json` | Per-project MCP and settings |
| `<project>/CLAUDE.md` | Project instructions |

The extension never writes to any of these files except `settings.json` (to inject hooks, only with user consent) and `.dashboard-events.jsonl` (created by the injected hooks).

---

## Token And Cost Semantics

- Token counts come from Claude's local JSONL session logs.
- Displayed `totalTokens` exclude cache-read tokens, because cache reads can dwarf the meaningful token count in long sessions.
- Estimated cost is computed locally from parsed token usage, detected model family, and a static pricing table bundled with the extension.
- Model detection is heuristic: `opus` maps to Opus pricing, `haiku` maps to Haiku pricing, and everything else falls back to Sonnet pricing.
- Aggregate estimated cost includes subagent-attributed cost when Claude spawns subagents.
- These numbers are helpful operational estimates, but they are not guaranteed to match Anthropic billing, invoices, or future price changes exactly.

---

## What It Does Not Do

- It does not intercept Claude's network calls or modify Claude's behaviour.
- It does not store data in a database or send it to any server.
- It does not require an API key.
- It does not work if you do not have Claude Code installed (`~/.claude/` must exist).
- It does not show content from sessions that happened before installation — it reads historical data from existing JSONL files, so past sessions are visible retroactively.

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
