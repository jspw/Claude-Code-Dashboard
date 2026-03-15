# Claude Code Dashboard

A VS Code extension that show you exactly what Claude is doing — tokens, costs, sessions, and insights across all your projects, right inside VS Code.

**No API key required. No data leaves your machine.**

---

## Screenshots

![Dashboard Overview](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashboard.png)
*Main dashboard — projects, stats, weekly recap, and cost overview*

![Dashboard Charts](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashboard-chart.png)
*Charts tab — 30-day token trend, usage by project, projected monthly cost*

![Dashboard Insights](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/dashbpard-insights.png)
*Insights tab — heatmap, tool usage, productivity by hour, hot files*

![Projects List](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/projects.png)
*Sidebar — all Claude Code projects with per-project stats*

![Session History](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/project-sessions.png)
*Project detail — full session history with prompt previews and token breakdown*

![Tool Usage](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/project-tools.png)
*Tools tab — which tools Claude used most across sessions*

![File Explorer](https://raw.githubusercontent.com/jspw/Claude-Code-Dashboard/main/images/screenshots/project-files.png)
*Files tab — every file Claude touched, with access counts*

---

## Requirements

- VS Code 1.85 or later
- [Claude Code](https://claude.ai/code) installed and used at least once (`~/.claude/` must exist)
- Node.js 18+ (for the build tools, not at runtime)

---

## Installation

### From source (development)

```bash
git clone <repo>
cd claude-dashboard
npm install
npm run build
cd webview-ui && npm install && cd ..
npm run build
```

Then press **F5** in VS Code to open an Extension Development Host with the extension loaded.

### Packaging for local install

```bash
npm install -g @vscode/vsce
npm run build
vsce package
```

This produces a `.vsix` file. Install it via:
- VS Code command palette → **Extensions: Install from VSIX...**
- Or: `code --install-extension claude-code-dashboard-0.1.0.vsix`

---

## Getting Started

1. After installation, click the **pulse icon** in the VS Code activity bar to open the Claude Projects sidebar.
2. The full dashboard opens automatically in a panel to the right.
3. On first run, you will be prompted to configure real-time hooks. Choosing **"Yes, configure hooks"** enables live session tracking (tool calls shown as they happen). This modifies `~/.claude/settings.json` — a backup is made first.

> If you skip hooks, the dashboard still works fully from historical data. You lose only the live "Claude is running" indicator.

---

## Using the Dashboard

### Overview tab
Shows your weekly recap, today's/week's tokens and cost, active sessions, and the full project list.

**Filtering projects:** Type in the filter box to search by project name. Use the sort dropdown to order by last active, total cost, or session count.

**Budget banner:** If you have set `claudeDashboard.monthlyBudgetUsd` in settings, a yellow banner appears at 80% spent and turns red at 100%.

### Charts tab
30-day token trend, usage by project, projected monthly cost, and cost breakdown by project.

### Search tab
Search across every prompt you have ever sent to Claude across all projects. Results show the project, session, and the matched text in context.

### Insights tab
Prompt category breakdown, usage heatmap by hour/day, efficiency stats, tool usage, productivity by hour, hot files, and recent file changes.

---

## Project Detail View

Click any project in the sidebar or dashboard to open its detail view.

**Sessions list** (left column):
- Each session shows date, time, duration, token count, and prompt count
- The italic line below is the first prompt you sent in that session
- ⚡ means the session used extended thinking mode
- Blue "+$X.XX subagents" means the session spawned subagents whose cost is included

**Session detail** (right column):
- Full token breakdown (input / cache write / cache read / output)
- Cache hit rate shown in green — higher is better (cheaper)
- Full turn-by-turn conversation with tool call display
- Files touched by the session

**CLAUDE.md tab:** Shows your project instructions file if one exists.

**MCP Servers tab:** Lists all configured MCP servers for this project (from global and project-level settings).

**Export:** Use the JSON or CSV buttons to export all session data for the project to a file.

---

## Configuration

Open VS Code settings (`Cmd+,` / `Ctrl+,`) and search for **Claude Code Dashboard**.

| Setting | Default | Description |
|---|---|---|
| `claudeDashboard.monthlyTokenBudget` | `0` | Monthly token cap. Alert fires when exceeded. Set to `0` to disable. |
| `claudeDashboard.monthlyBudgetUsd` | `0` | Monthly cost cap in USD. Alerts at 80% and 100%. Set to `0` to disable. |

Example `settings.json`:
```json
{
  "claudeDashboard.monthlyBudgetUsd": 50,
  "claudeDashboard.monthlyTokenBudget": 5000000
}
```

---

## Commands

All commands are available via the VS Code command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Description |
|---|---|
| `Claude Code Dashboard: Open Full Dashboard` | Opens or focuses the main dashboard panel |
| `Claude Code Dashboard: Open Project Detail` | Opens a project by ID (used internally by sidebar clicks) |
| `Claude Code Dashboard: Refresh` | Re-scans all projects and sessions |

The refresh button (⟳) also appears in the sidebar title bar.

---

## Development Workflow

### Running in development

```bash
# Terminal 1: watch and rebuild the extension
npm run watch:ext

# Terminal 2: watch and rebuild the React UI
npm run watch:ui

# Then press F5 in VS Code to launch the Extension Development Host
# After making changes: Cmd+R (or Ctrl+R) inside the dev host to reload
```

> The Vite dev server (`watch:ui`) gives you hot module replacement but the output needs to be in `webview-ui/dist/` for the extension to pick it up. `vite build --watch` (what `watch:ui` runs) writes to `dist/` on every change, which is what the extension actually loads.

### Building for release

```bash
npm run build         # compiles extension + React UI
```

### Project layout

```
src/                  # Extension host (Node.js / VS Code API)
webview-ui/src/       # React UI (runs in webview sandbox)
webview-ui/dist/      # Built UI (loaded by extension at runtime)
dist/                 # Built extension
```

Changes to `src/` require rebuilding with `build:ext`.
Changes to `webview-ui/src/` require rebuilding with `build:ui`.

---

## Hooks (Real-Time Tracking)

The real-time feature works by injecting two entries into `~/.claude/settings.json`:

- **PostToolUse** — fires after every tool call and appends a JSON line to `~/.claude/.dashboard-events.jsonl`
- **Stop** — fires when a session ends

The extension polls `.dashboard-events.jsonl` every 500ms for new lines and pushes live events to the dashboard UI.

**To remove hooks manually**, open `~/.claude/settings.json` and delete the entries that reference `.dashboard-events.jsonl` from the `hooks.PostToolUse` and `hooks.Stop` arrays. A backup of the original file is at `~/.claude/settings.json.bak`.

---

## Troubleshooting

**Dashboard shows no projects**
- Verify `~/.claude/projects/` exists and contains subdirectories
- Run the **Claude Code Dashboard: Refresh** command
- Check the VS Code Output panel (select "Claude Code Dashboard" in the dropdown) for errors

**Sessions not updating in real time**
- Confirm hooks were configured (first-run prompt)
- Check `~/.claude/settings.json` for entries referencing `.dashboard-events.jsonl`
- The fallback (file watcher) still updates within ~300ms of a session file change

**Cost numbers look wrong**
- Cost is estimated using Anthropic's published per-model token rates
- Cache read tokens are excluded from `totalTokens` (they are tracked separately as `cacheReadTokens`) — this is intentional; cache reads are billed at ~10% of regular input tokens and would inflate counts
- The model is auto-detected from the session file; if detection fails it defaults to Sonnet pricing

**Extension Development Host: "Extension Development Host" in the title bar**
- This is normal when running via F5. The extension behaves identically to the installed version.

**`settings.json` was corrupted after hook injection**
- Restore from the backup: `cp ~/.claude/settings.json.bak ~/.claude/settings.json`

---

## Data Privacy

The extension only reads files in `~/.claude/` and your project directories. It does not make any network requests. It does not use telemetry. The only files it writes are:

- `~/.claude/settings.json` — hook configuration (with user consent; backup made first)
- `~/.claude/.dashboard-events.jsonl` — live events written by the injected hooks
- `~/.claude/settings.json.bak` — backup of settings before hook injection

---

## License

[AGPL-3.0](LICENSE) — free to use and modify, but any modified version must also be released under the same license. Commercial reselling is not permitted.
