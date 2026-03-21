# Claude Code Dashboard

A VS Code extension that shows you exactly what Claude is doing — tokens, costs, sessions, and insights across all your projects, right inside VS Code.

**No API key required. No data leaves your machine.**

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/jspw.claude-code-dashboard?label=VS%20Code%20Marketplace&logo=visualstudiocode&logoColor=white&color=E8783A)](https://marketplace.visualstudio.com/items?itemName=jspw.claude-code-dashboard)
[![Open VSX](https://img.shields.io/open-vsx/v/jspw/claude-code-dashboard?label=Open%20VSX&color=B85FFF)](https://open-vsx.org/extension/jspw/claude-code-dashboard)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/Website-claude--code--dashboard-E8783A)](https://claude-code-dashboard-jspw.vercel.app)

---

## Screenshots

![Dashboard Overview](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashboard.png)
*Main dashboard — projects, stats, weekly recap, and cost overview*

![Dashboard Charts](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashboard-chart.png)
*Charts tab — 30-day token trend, usage by project, projected monthly cost*

![Dashboard Insights](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashbpard-insights.png)
*Insights tab — heatmap, tool usage, productivity by hour, hot files*

![Session History](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/project-sessions.png)
*Project detail — session history with prompt previews and token breakdown*

---

## Installation

Search for **Claude Code Dashboard** in the VS Code Extensions panel, or install directly:

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jspw.claude-code-dashboard)
- [Open VSX](https://open-vsx.org/extension/jspw/claude-code-dashboard) (for VSCodium / other forks)

**Requirements:** VS Code 1.85+ and [Claude Code](https://claude.ai/code) installed and used at least once.

---

## Getting started

1. Click the **pulse icon** in the VS Code activity bar to open the Claude Projects sidebar.
2. The full dashboard opens automatically to the right.
3. On first run you'll be prompted to enable real-time hooks — choose **"Yes, configure hooks"** for live session tracking. A backup of `~/.claude/settings.json` is made first.

> Skipping hooks is fine — the dashboard still shows all historical data. You only lose the live "Claude is running" indicator.

---

## What's inside

| Tab | What you see |
|---|---|
| **Overview** | Weekly recap, today's tokens & cost, active sessions, full project list |
| **Charts** | 30-day token trend, usage by project, projected monthly cost |
| **Search** | Full-text search across every prompt you've ever sent to Claude |
| **Insights** | Usage heatmap, tool breakdown, productivity by hour, hot files |

**Project detail view** — click any project to see its full session history, turn-by-turn conversation, token breakdown, files touched, CLAUDE.md, and MCP servers. Export to JSON or CSV any time.

---

## Configuration

Search for **Claude Code Dashboard** in VS Code settings (`Cmd+,` / `Ctrl+,`).

| Setting | Default | Description |
|---|---|---|
| `claudeDashboard.monthlyTokenBudget` | `0` | Monthly token cap. Set to `0` to disable. |
| `claudeDashboard.monthlyBudgetUsd` | `0` | Monthly cost cap in USD. Alerts at 80% and 100%. Set to `0` to disable. |

---

## Troubleshooting

**No projects showing**
— Verify `~/.claude/projects/` exists, then run **Claude Code Dashboard: Refresh** from the command palette. Check the Output panel (select "Claude Code Dashboard") for errors.

**Sessions not updating in real time**
— Confirm hooks were configured at first run. Check `~/.claude/settings.json` for entries referencing `.dashboard-events.jsonl`. The file watcher fallback still updates within ~300ms.

**Cost numbers look off**
— Costs are estimated from Anthropic's published per-model token rates. Cache read tokens are tracked separately and excluded from `totalTokens` (they bill at ~10% of regular input tokens).

**Corrupted `settings.json` after hook injection**
— Restore the backup: `cp ~/.claude/settings.json.bak ~/.claude/settings.json`

---

## Data privacy

The extension only reads files in `~/.claude/` and your project directories. No network requests. No telemetry. The only files it ever writes are:

- `~/.claude/settings.json` — hook config (with your consent; backup made first)
- `~/.claude/.dashboard-events.jsonl` — live events from the injected hooks
- `~/.claude/settings.json.bak` — backup before hook injection

---

## Contributing

Contributions are welcome! Please read the [Contributing guide](CONTRIBUTING.md) before opening a PR.

- [Report a bug](https://github.com/jspw/Claude-Code-Dashboard/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/jspw/Claude-Code-Dashboard/issues/new?template=feature_request.yml)
- [Ask a question](https://github.com/jspw/Claude-Code-Dashboard/discussions)

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities privately.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## License

[AGPL-3.0](LICENSE) — free to use and modify, but any modified version must also be released under the same license. Commercial reselling is not permitted.
