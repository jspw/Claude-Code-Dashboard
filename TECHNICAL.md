# Claude Code Dashboard Technical Reference

This document explains how Claude Code Dashboard is structured, how data moves through the system, and which implementation choices matter if you want to extend, debug, or publish the project.

## Overview

Claude Code Dashboard is a VS Code extension that reads local Claude Code session data from `~/.claude`, computes analytics, and renders those analytics inside VS Code webviews.

The project has two runtime halves:

1. The extension host, which runs in Node.js and has access to the file system, process state, and the VS Code API.
2. The webview UI, which runs in a browser sandbox and renders the dashboard using React.

Those halves never share memory directly. All UI state must be serialized in the extension host and sent into the webview.

## Repository Layout

```text
claude-dashboard/
├── src/                         # VS Code extension source
│   ├── extension.ts             # Activation entry point
│   ├── alerts/                  # Budget warnings and weekly digest
│   ├── hooks/                   # Claude hook injection
│   ├── parsers/                 # Session/settings parsing
│   ├── providers/               # Sidebar and status bar integration
│   ├── store/                   # Central analytics/state store
│   ├── watchers/                # File and event watchers
│   └── webviews/                # Dashboard and project panel hosts
├── webview-ui/                  # React webview app
│   ├── src/
│   │   ├── App.tsx              # View bootstrap and message bridge
│   │   ├── components/          # Reusable UI pieces and charts
│   │   ├── views/               # Dashboard, project detail, sidebar
│   │   ├── utils/               # UI formatting helpers
│   │   └── vscode.ts            # acquireVsCodeApi() bridge
│   └── dist/                    # Built webview assets
├── docs/                        # Supporting documentation
├── esbuild.js                   # Extension bundler
├── vitest.config.ts             # Extension test config
└── webview-ui/vitest.config.ts  # UI test config
```

## Runtime Architecture

### Extension Host

The extension host is responsible for:

- Discovering Claude projects under `~/.claude/projects`
- Parsing session JSONL files
- Reading Claude settings and project configuration
- Tracking live sessions from `~/.claude/sessions`
- Watching for file updates and hook events
- Computing aggregate analytics
- Pushing serialized state into webviews

This logic lives under [`src/`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src).

### Webview UI

The webview UI is responsible for:

- Rendering dashboard and project views
- Displaying analytics already computed by the extension host
- Requesting additional data when needed, such as full session turns
- Posting user actions back to the extension host

This logic lives under [`webview-ui/src/`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/webview-ui/src).

## Data Flow

### Session Parsing Flow

```text
~/.claude/projects/<project>/*.jsonl
        ↓
SessionParser.parseFile()
        ↓
DashboardStore
        ↓
DashboardPanel / ProjectPanel / SidebarProvider / StatusBarProvider
        ↓
Webview postMessage()
        ↓
App.tsx state merge
        ↓
React views and components
```

### Live Update Flow

```text
Claude hook event
        ↓
~/.claude/.dashboard-events.jsonl
        ↓
EventWatcher.checkForNewEvents()
        ↓
DashboardStore.handleLiveEvent()
        ↓
store emits "liveEvent" and debounced "updated"
        ↓
open webviews receive postMessage()
```

## Core Backend Components

### `DashboardStore`

[`src/store/DashboardStore.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/store/DashboardStore.ts) is the central in-memory model. It extends `EventEmitter` and is shared across the extension.

It owns:

- `projects: Map<string, Project>`
- `sessions: Map<string, Session[]>`
- `subagentSessions: Map<string, Session[]>`
- `activeSessions: Map<string, Session>`
- an optional on-disk cache stored in `context.globalStorageUri.fsPath`

Key responsibilities:

- Initial project scanning
- Incremental reloads on file change
- Live session state updates
- Subagent cost attribution
- MCP server aggregation
- Dashboard and project analytics

Important behavior:

- Project data is cached to `project-cache.json` when a cache directory is provided.
- Cache entries are invalidated by `CACHE_VERSION` and project JSONL `mtime`.
- Live session state is never trusted from cache. It is always re-evaluated from process metadata.
- Rapid changes are coalesced with a 200ms debounce before emitting `updated`.

### `SessionParser`

[`src/parsers/SessionParser.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/parsers/SessionParser.ts) converts Claude JSONL session files into typed session objects.

It extracts:

- start and end times
- prompt count
- tool call count
- files modified and created
- token usage
- cache usage
- estimated cost
- session summary
- thinking usage
- idle time and active time

Token accounting rules:

- `totalTokens = inputTokens + cacheCreationTokens + outputTokens`
- `cacheReadTokens` are tracked separately and excluded from `totalTokens`
- `costUsd` uses input, output, cache write, and cache read rates

Model pricing is inferred by substring matching in the assistant model name:

- `opus` → `claude-opus-4`
- `haiku` → `claude-haiku-4`
- otherwise → `claude-sonnet-4`

### `SettingsParser`

[`src/parsers/SettingsParser.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/parsers/SettingsParser.ts) reads configuration from several locations:

- `~/.claude/settings.json`
- `~/.claude.json`
- `<project>/.claude/settings.json`
- `<project>/.mcp.json`
- `<project>/CLAUDE.md`
- `<project>/.claude/commands/*.md`

It is intentionally tolerant:

- missing files return empty objects or `null`
- invalid JSON is ignored rather than crashing the extension

### `HookManager`

[`src/hooks/HookManager.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/hooks/HookManager.ts) injects lightweight Claude hooks into `~/.claude/settings.json`.

It writes two hook groups:

- `PostToolUse`
- `Stop`

Those hooks append condensed JSONL events into:

- `~/.claude/.dashboard-events.jsonl`

Implementation details:

- existing dashboard-managed hooks are removed before reinjection
- `settings.json` is backed up to `settings.json.bak`
- hook schema changes are tracked with `HOOK_VERSION`

### `FileWatcher`

[`src/watchers/FileWatcher.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/watchers/FileWatcher.ts) watches `~/.claude/projects` with Node’s `fs.watch`.

Why not VS Code’s file watcher:

- Claude data lives outside the current workspace
- `createFileSystemWatcher` is workspace-oriented
- `fs.watch` can monitor `~/.claude` directly

Behavior:

- only `.jsonl` files are considered
- updates are debounced per file for 300ms

### `EventWatcher`

[`src/watchers/EventWatcher.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/watchers/EventWatcher.ts) polls `.dashboard-events.jsonl` every 500ms.

Behavior:

- tracks a byte offset, so only newly appended data is read
- ignores malformed lines
- rotates the file when it exceeds 5MB
- keeps the last 1000 lines on rotation

### `AlertManager`

[`src/alerts/AlertManager.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/alerts/AlertManager.ts) handles user-facing budget notifications.

Supported alerts:

- monthly token budget exceeded
- monthly cost budget at 80%
- monthly cost budget exceeded
- weekly digest on Mondays

Rate limiting:

- token and cost alerts fire at most once per day
- weekly digest requires at least six days since the last digest

## Webview Host Components

### `DashboardPanel`

[`src/webviews/DashboardPanel.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/webviews/DashboardPanel.ts) hosts the main dashboard panel.

It is a singleton and sends a serialized dashboard state including:

- project list
- top-level stats
- usage over time
- heatmap data
- prompt categories
- tool usage
- hot files
- projected cost
- streak and efficiency metrics
- weekly recap
- recent file changes
- productivity by hour
- budget status

### `ProjectPanel`

[`src/webviews/ProjectPanel.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/webviews/ProjectPanel.ts) hosts a per-project detail view.

Important detail:

- sessions are initially sent without `turns`
- full turns are fetched lazily when the UI requests `getSessionTurns`

That keeps initial payloads smaller for large projects.

### `SidebarProvider`

[`src/providers/SidebarProvider.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/providers/SidebarProvider.ts) powers the activity bar sidebar webview.

It exposes a compact state:

- `projects`
- `stats`

It also routes UI messages back into VS Code commands such as opening the dashboard or a project.

### `StatusBarProvider`

[`src/providers/StatusBarProvider.ts`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/src/providers/StatusBarProvider.ts) renders a compact status bar summary.

It shows:

- active session count when non-zero
- today’s tokens
- today’s cost

## Webview UI Structure

### `App.tsx`

[`webview-ui/src/App.tsx`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/webview-ui/src/App.tsx) is the UI entry router.

It reads:

- `window.__INITIAL_VIEW__`
- `window.__INITIAL_DATA__`

It supports three host views:

- `dashboard`
- `project`
- `sidebar`

Subsequent updates come through `window.postMessage` and are shallow-merged into React state.

### `Dashboard.tsx`

[`webview-ui/src/views/Dashboard.tsx`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/webview-ui/src/views/Dashboard.tsx) renders the main dashboard.

Current tabs:

- Overview
- Charts
- Insights

This view contains:

- budget banner
- weekly recap
- project list
- active project cards
- charts and heatmap
- tool usage and prompt categories
- productivity and recent changes

### `ProjectDetail.tsx`

[`webview-ui/src/views/ProjectDetail.tsx`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/webview-ui/src/views/ProjectDetail.tsx) renders project-specific detail pages.

Current tabs:

- Sessions
- Weekly
- CLAUDE.md
- Commands
- Tools
- MCP Servers
- Subagents
- Files

This is the most conditional UI in the codebase and the main place where project-level features come together.

### `Sidebar.tsx`

[`webview-ui/src/views/Sidebar.tsx`](/Users/mhshifat/Documents/personal-work/products/claude-code-dashboard/claude-dashboard/webview-ui/src/views/Sidebar.tsx) renders the compact activity-bar experience.

Projects are grouped into:

- Active
- Recent
- Older

## Data Formats

### Session JSONL User Entry

```json
{
  "type": "user",
  "uuid": "abc-123",
  "timestamp": "2024-01-15T10:23:45.000Z",
  "cwd": "/Users/alice/code/myapp",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "Fix the auth bug" }]
  }
}
```

### Session JSONL Assistant Entry

```json
{
  "type": "assistant",
  "uuid": "def-456",
  "timestamp": "2024-01-15T10:23:47.500Z",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-6",
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 1500,
      "output_tokens": 340,
      "cache_creation_input_tokens": 12000,
      "cache_read_input_tokens": 45000
    },
    "content": [
      { "type": "thinking", "thinking": "...", "thinking_tokens": 800 },
      { "type": "text", "text": "I'll fix the auth bug by..." },
      { "type": "tool_use", "id": "tu_1", "name": "Read", "input": { "file_path": "/src/auth.ts" } }
    ]
  }
}
```

### Live Session Metadata

```json
{
  "pid": 12345,
  "sessionId": "abc-def-123",
  "cwd": "/Users/alice/code/myapp",
  "startedAt": "2024-01-15T10:20:00.000Z"
}
```

### Hook Event Line

```json
{
  "type": "tool_use",
  "tool": "Read",
  "sessionId": "abc-def-123",
  "timestamp": 1705312800000
}
```

## Build and Packaging

### Extension Build

The extension is bundled with esbuild as CommonJS because VS Code expects a Node-compatible extension entrypoint.

```bash
npm run build:ext
npm run watch:ext
```

### Webview Build

The UI is built with Vite and emitted into `webview-ui/dist`.

```bash
npm run build:ui
npm run watch:ui
```

### Full Build

```bash
npm run build
```

## Testing

The project has separate Vitest setups for the extension host and the webview UI.

Commands:

```bash
npm test
npm run test:coverage
cd webview-ui && npm test
cd webview-ui && npm run test:coverage
```

Current test strategy includes:

- parser unit tests
- store analytics tests
- hook and watcher tests
- extension activation and command-flow tests
- webview component tests
- UI bootstrap smoke test

## Performance Characteristics

### Startup

Project scanning is synchronous per file read but bounded by cache reuse where possible. On restart, unchanged projects can be restored from cache instead of being reparsed.

### Memory

Parsed sessions, including turns, are retained in memory. This keeps view updates fast at the cost of a moderate heap footprint for users with many long sessions.

### Watchers

The file watcher is event-based, while the hook event watcher is polling-based. The event watcher is intentionally lightweight because it reads only appended bytes.

## Error Handling

The extension prefers resilience over strict failure:

- malformed JSONL lines are skipped
- unreadable config files fall back to empty values
- project-level load failures are logged and do not block other projects
- malformed live events are ignored
- missing optional UI data is rendered with empty states

This approach keeps the dashboard useful even when Claude data is partially malformed or mid-write.

## Configuration

The extension currently exposes two user settings:

| Key | Type | Default | Purpose |
| --- | --- | --- | --- |
| `claudeDashboard.monthlyTokenBudget` | `number` | `0` | Token budget alert threshold |
| `claudeDashboard.monthlyBudgetUsd` | `number` | `0` | Cost budget alert threshold |

`0` disables the corresponding alert.

## Current Limitations

### Windows file watching

Recursive `fs.watch` behavior is less reliable on Windows than on macOS. The current implementation favors the simplest cross-platform solution, but Windows users may see occasional missed reloads.

### In-memory session retention

Sessions are retained in memory once parsed. This is acceptable for normal use, but extremely large histories could benefit from more aggressive eviction or lazy loading.

### VS Code-hosted end-to-end automation

The test suite now includes smoke-level integration coverage, but it does not yet run a full VS Code-hosted end-to-end workflow. If the project needs marketplace-grade regression protection, that would be the next investment.

## Publishing Notes

If you are publishing this project or documentation publicly, the most important framing is:

- Claude Code Dashboard is local-first
- it reads Claude artifacts from the user’s machine
- no external service is required for analytics
- the UI is a presentation layer over locally computed state

That positioning matches the architecture and is the clearest mental model for users and contributors.
