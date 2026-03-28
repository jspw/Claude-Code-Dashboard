# Claude Code Dashboard

VS Code extension webview UI. Source: `webview-ui/src/`.

---

## UI/UX Design Guidelines

### Stack
- React + TypeScript + Tailwind CSS — no custom CSS classes
- Recharts only for charts — no other chart libs
- **No external UI lib** (no shadcn, MUI, Radix)
- **No icon lib** — inline SVG only (12×12 or 14×14, `fill="currentColor"`)

### Theming — VS Code variables first
All colors use `var(--vscode-*)` so the UI respects any user theme.

Key variables: `--vscode-editor-background`, `--vscode-editor-foreground`, `--vscode-panel-border`, `--vscode-button-background`, `--vscode-button-foreground`, `--vscode-list-hoverBackground`, `--vscode-list-activeSelectionBackground/Foreground`, `--vscode-badge-background/foreground`.

Tailwind colors are **only** for semantic status:
- Success/active → `green-400`, `green-500/20`
- Warning → `yellow-400`, `yellow-500/20`
- Info/subagents → `blue-400`, `blue-500/20`
- Error → `red-400`, `red-500/20`

### Typography scale
| Role | Classes |
|---|---|
| Page title | `text-2xl font-bold` |
| Section header | `text-sm font-semibold uppercase tracking-wider opacity-60` |
| Body / list | `text-sm` |
| Secondary labels | `text-xs opacity-60` |
| Tertiary / disabled | `text-xs opacity-40` |
| Code / paths | `text-xs font-mono` |
| Metric values | `text-xl font-bold` |

Always add `truncate` on potentially long strings.

### Button patterns (quick reference)
- **Outline action**: `text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors`
- **Tab active/inactive**: border-b-2, active gets `border-[var(--vscode-button-background)]`, inactive `border-transparent opacity-60`
- **Toggle pair**: `flex rounded overflow-hidden border border-[var(--vscode-panel-border)]`; active = button-background fill
- **List item**: `hover:bg-[var(--vscode-list-hoverBackground)]`; selected = `bg-[var(--vscode-list-activeSelectionBackground)]`
- **Icon-only**: `opacity-40 hover:opacity-100 transition-opacity`
- **ID chip**: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono` — shows first 8 chars, copies full value on click

### Key reusable patterns
- **StatCard**: `rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4` with `text-xs opacity-50` label and `text-xl font-bold` value
- **Badge**: `text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded`
- **Live dot**: `<span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />`

### Do not
- No external UI libs (shadcn, MUI, Radix, etc.)
- No hardcoded colors — only VS Code variables or approved semantic Tailwind colors
- No `rounded-xl` or larger; no `shadow-*`
- No icon libraries (lucide, heroicons, etc.)
- No Unicode copy symbols (`⎘`, `📋`) — use inline SVG

For the full design reference (all SVGs, chart color palettes, layout patterns, spacing rules), run `/ui-patterns`.

---

## Architecture

### Overview

VS Code extension with two halves:
- **Backend** (`src/`) — Node.js extension that reads `~/.claude/` JSONL files, computes analytics, and pushes state to webviews via `postMessage`
- **Frontend** (`webview-ui/src/`) — React app rendered inside VS Code webview panels. Three views: Dashboard, ProjectDetail, Sidebar

Data flows one way: `JSONL files → FileWatcher → DashboardStore → Panel.buildState() → postMessage → React state`

### Backend (`src/`)

| File | Purpose |
|---|---|
| `extension.ts` | Entry point. Registers sidebar, commands, initializes store + watchers. Activates on `onStartupFinished` |
| `store/DashboardStore.ts` | Central EventEmitter store. Owns `projects`, `sessions`, `subagentSessions` maps. All analytics computed here via getter methods (`getStats()`, `getUsageOverTime()`, `getHeatmapData()`, `getProjectStats()`, etc.) |
| `parsers/SessionParser.ts` | Parses JSONL → `Session` objects. Extracts tokens, costs (per-model pricing), tool calls, files, thinking tokens, cache hit rate |
| `parsers/SettingsParser.ts` | Reads `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, `.claude/commands/*.md` |
| `watchers/FileWatcher.ts` | `fs.watch()` on `~/.claude/projects/*.jsonl`, debounces 300ms, calls `store.onFileChanged()` |
| `watchers/EventWatcher.ts` | Polls `~/.claude/.dashboard-events.jsonl` every 500ms for live tool_use/session_stop events |
| `hooks/HookManager.ts` | Injects PostToolUse/Stop hooks into `~/.claude/settings.json` (with user consent) |
| `alerts/AlertManager.ts` | Budget alerts (80%/100%) and weekly Monday digest |
| `webviews/DashboardPanel.ts` | Singleton webview for main dashboard. `buildState()` assembles all analytics |
| `webviews/ProjectPanel.ts` | Per-project webview (`Map<projectId, panel>`). Strips turns from sessions (loaded on demand via `getSessionTurns` message) |
| `webviews/getWebviewContent.ts` | Generates HTML with `window.__INITIAL_VIEW__` and `window.__INITIAL_DATA__` |
| `providers/SidebarProvider.ts` | Activity bar sidebar. Routes `openDashboard`/`openProject` messages |
| `providers/StatusBarProvider.ts` | Status bar: active sessions, today's tokens/cost |

### Frontend (`webview-ui/src/`)

| File | Purpose |
|---|---|
| `main.tsx` | React entry point |
| `App.tsx` | Bootstrap: reads `__INITIAL_VIEW__` + `__INITIAL_DATA__`, listens for `stateUpdate`/`liveEvent` messages, renders correct view |
| `types.ts` | All shared TypeScript interfaces |
| `vscode.ts` | `acquireVsCodeApi()` bridge |
| `utils/format.ts` | `formatTokens()`, `formatDuration()`, `timeAgo()` |
| `utils/toolColor.ts` | Tool name → consistent color mapping |

**Views:**

| View | File | Description |
|---|---|---|
| Dashboard | `views/Dashboard.tsx` | 3 tabs: Overview (recap, stats, projects), Charts (usage, cost), Insights (heatmap, efficiency, tools, hot files) |
| ProjectDetail | `views/ProjectDetail.tsx` | 8 tabs: Sessions, Weekly, CLAUDE.md, Commands, Tools, MCP Servers, Subagents, Files |
| Sidebar | `views/Sidebar.tsx` | Compact project list grouped by Active/Recent/Older with stats |

**Components (all in `components/`):**

| Component | Used in |
|---|---|
| `SessionList.tsx`, `SessionDetail.tsx` | ProjectDetail → Sessions tab |
| `WeeklyStatsTab.tsx` | ProjectDetail → Weekly tab |
| `MarkdownView.tsx` (+ `CommandBlock`) | ProjectDetail → CLAUDE.md & Commands tabs |
| `ToolUsageBar.tsx` | ProjectDetail → Tools tab, Dashboard → Insights |
| `UsageLineChart.tsx` | Dashboard → Charts (30-day line) |
| `ProjectBarChart.tsx` | Dashboard → Charts (by project) |
| `HeatmapGrid.tsx` | Dashboard → Insights |
| `PatternChart.tsx` | Dashboard → Insights |
| `ProductivityChart.tsx` | Dashboard → Insights |
| `EfficiencyCards.tsx` | Dashboard → Insights |
| `HotFilesList.tsx` | Dashboard → Insights |
| `RecentChanges.tsx` | Dashboard → Insights |
| `ProjectCard.tsx` | Dashboard → Overview |
| `PromptSearch.tsx` | Dashboard → Search tab |
| `ActiveSessionCard.tsx`, `LiveSessionBanner.tsx` | Dashboard → Overview |
| `ActivityFeed.tsx` | Dashboard |

### Message Protocol

**Backend → Webview:**
- `{ type: 'stateUpdate', payload: {...} }` — full or partial state refresh
- `{ type: 'liveEvent', payload: { type, tool?, projectId?, sessionId?, timestamp } }` — real-time hook events
- `{ type: 'sessionTurns', sessionId, turns[] }` — lazy-loaded turn data

**Webview → Backend:**
- `{ type: 'openDashboard' }` / `{ type: 'openProject', projectId }`
- `{ type: 'getSessionTurns', sessionId }` — triggers `sessionTurns` response
- `{ type: 'exportSessions', format: 'json' | 'csv' }`

### State Management

No Redux/Context. App-level `useState<unknown>` holds server state, merged on each `stateUpdate` message. Views manage local UI state (selected tab, sort order, selected session) via component-local `useState`.

Session turns are **lazy-loaded**: initial state ships sessions with `turns: []`. When a user selects a session, webview sends `getSessionTurns` and the backend responds with the full turn array.

### Key Data Types (in `webview-ui/src/types.ts`)

- **Project** — `{ id, name, path, lastActive, isActive, sessionCount, totalTokens, totalCostUsd, techStack[] }`
- **Session** — `{ id, projectId, parentSessionId, startTime, endTime, durationMs, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, costUsd, promptCount, toolCallCount, filesModified[], filesCreated[], turns[], sessionSummary, hasThinking, thinkingTokens, cacheHitRate, subagentCostUsd, idleTimeMs, activeTimeMs, activityRatio }`
- **Turn** — `{ id, role, content, inputTokens, outputTokens, toolCalls[], timestamp }`
- **ToolCall** — `{ id, name, input, output?, mcpServer? }`
- **ProjectConfig** — `{ claudeMd, mcpServers, projectSettings, commands[] }`
- **ProjectStats** — `{ usageOverTime[], toolUsage[], promptPatterns[], efficiency, recentToolCalls[], weeklyStats }`
- **DashboardStats** — `{ totalProjects, activeSessionCount, tokensTodayTotal, costTodayUsd, tokensWeekTotal, costWeekUsd }`

Other types: `DailyUsage`, `ProjectUsage`, `HeatmapCell`, `PatternCount`, `ToolUsageStat`, `HotFile`, `ProjectedCost`, `StreakData`, `EfficiencyStats`, `WeeklyRecap`, `RecentFileChange`, `ProductivityHour`, `BudgetStatus`, `ProjectFile`, `ProjectToolCall`, `WeeklyProjectStats`, `McpServer`, `PromptSearchResult`

### How to Add a New ProjectDetail Tab

1. **Add tab key** to `Tab` union and `TAB_LABELS` array in `views/ProjectDetail.tsx`
2. **Add render block**: `{activeTab === 'yourTab' && <YourComponent ... />}`
3. **If new data needed from backend:**
   - Add getter to `DashboardStore` (e.g., `getYourData(projectId)`)
   - Add to `ProjectPanel.buildState()` return object
   - Add interface to `webview-ui/src/types.ts`
   - Add prop to `ProjectDetail` component's `Props` interface
   - Add to destructuring in `App.tsx` project view branch
4. **Create component** in `components/YourComponent.tsx` if non-trivial

### How to Add a New Dashboard Section

1. **Add getter** to `DashboardStore` if new data
2. **Add to `DashboardPanel.buildState()`** return object
3. **Add interface** to `types.ts`, add prop to `Dashboard.tsx`
4. **Add to `App.tsx`** dashboard destructuring
5. **Render** in the appropriate tab (Overview/Charts/Insights) in `Dashboard.tsx`

### Testing

- **Framework:** Vitest (both backend and frontend)
- **Frontend extras:** React Testing Library + jsdom
- **Coverage target:** 80% lines, 75% branches, 80% functions
- **Run:** `npm test` (backend) · `cd webview-ui && npm test` (frontend) · `npm run test:all` (both)
- **Structure:** Each source file has a co-located `__tests__/` directory
- **Fixtures:** `src/__tests__/fixtures/` and `webview-ui/src/__tests__/fixtures/`

### Not Yet Implemented

These Claude Code features are **not captured or displayed** by the dashboard:
- **Memory** — `~/.claude/projects/{path}/memory/MEMORY.md` + individual memory files
- **Todos/Tasks** — `TodoWrite` tool calls within sessions
- **Plans** — Implementation plans created during sessions
- **Git commits by Claude** — commits with `Co-Authored-By: Claude` signature
- **Scheduled triggers** — cron-based remote agents
- **Worktrees** — isolated git worktrees created by subagents
- **Model per session** — parsed for cost calc but not shown in UI
- **Project settings** — parsed but not surfaced in webview
- **Hook configuration** — used internally but not visualized
