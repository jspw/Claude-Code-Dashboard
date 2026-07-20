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
| `hooks/HookManager.ts` | Injects/removes PostToolUse+Stop hooks in `~/.claude/settings.json` (with user consent). Hooks are armed by a `~/.claude/.dashboard-live` marker and no-op without it |
| `hooks/stripDashboardHooks.ts` | Pure helper that strips dashboard hook entries from a parsed settings object (shared with uninstall) |
| `uninstall.ts` | `vscode:uninstall` script — removes hooks, marker, and event file after uninstall |
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
| Dashboard | `views/Dashboard.tsx` | 3 tabs: Home (budget, stats, weekly recap, projects), Analytics (spend/patterns/tools/efficiency with a 7/30/90-day range control), Sessions (cross-project browser + prompt search) |
| ProjectDetail | `views/ProjectDetail.tsx` | 5 tabs: Overview (stat cards, recent sessions, quick links), Sessions (day-grouped list + subagent toggle + detail), Activity (usage trend, files, tools, commits), Setup (CLAUDE.md, memory, commands, MCP, automation), Work (plans + todos — hidden when both empty) |
| Sidebar | `views/Sidebar.tsx` | Compact project list grouped by Active/Recent/Older with stats |

**Components (all in `components/`):**

| Component | Used in |
|---|---|
| `SessionDetail.tsx` (+ `modelLabel`, `modelBadgeColor`) | ProjectDetail → Sessions tab; session meta header + copy-resume-command button; renders turns via `conversation/` |
| `conversation/` (`ConversationTurn`, `ResponseGroup`, `UserMessageCard`, `ThinkingRow`, `ToolCallRow`, `AgentCallBlock`, `SkillContextRow`, `SystemEventRow`, `shared.tsx`, `systemEvents.ts`) | Claude-Code-extension-style conversation timeline: user prompt cards ("You" header + accent border), tool-colored dots joined by connector lines (everything between two user prompts merges into one `ResponseGroup`), tool "OUT" output boxes, project-relative file hints, show-less-by-default messages |
| `SessionsBrowser.tsx` | Dashboard → Sessions tab (cross-project rows + backend-served prompt search) |
| `WeeklyStatsTab.tsx` | ProjectDetail → Activity (usage trend) |
| `MarkdownView.tsx` (+ `CommandBlock`) | ProjectDetail → Setup (CLAUDE.md, memory, commands) |
| `ToolUsageBar.tsx` | ProjectDetail → Activity, Dashboard → Analytics |
| `UsageLineChart.tsx` | Dashboard → Analytics (30-day line) |
| `ProjectBarChart.tsx` | Dashboard → Analytics (by project) |
| `HeatmapGrid.tsx` | Dashboard → Analytics |
| `PatternChart.tsx` | Dashboard → Analytics |
| `ProductivityChart.tsx` | Dashboard → Analytics |
| `EfficiencyCards.tsx` | Dashboard → Analytics |
| `HotFilesList.tsx` | Dashboard → Analytics |
| `RecentChanges.tsx` | Dashboard → Analytics |
| `PromptSearch.tsx` | Deprecated (superseded by `SessionsBrowser`); pending deletion |

### Message Protocol

**Backend → Webview:**
- `{ type: 'stateUpdate', payload: {...} }` — full or partial state refresh (dashboard payload includes `showTour`)
- `{ type: 'liveEvent', payload: { type, tool?, projectId?, sessionId?, timestamp } }` — real-time hook events (App.tsx ignores these for state; the store follows each with a debounced `stateUpdate`)
- `{ type: 'sessionTurns', sessionId, turns[] }` — lazy-loaded turn data
- `{ type: 'allSessions', sessions[] }` — cross-project `SessionRow[]` for the dashboard Sessions tab
- `{ type: 'promptSearchResults', query, results[] }` — backend-served prompt search
- `{ type: 'selectSession', sessionId }` — deep-link: select a session in an already-open ProjectPanel

**Webview → Backend:**
- `{ type: 'openDashboard' }` / `{ type: 'openProject', projectId, sessionId? }`
- `{ type: 'getSessionTurns', sessionId }` — triggers `sessionTurns` response
- `{ type: 'getAllSessions' }` / `{ type: 'searchPrompts', query }` — dashboard Sessions tab
- `{ type: 'exportSessions', format: 'json' | 'csv' }`
- `{ type: 'setBudget' }` — opens the budget input box; `{ type: 'dismissTour' }`; `{ type: 'refresh' }`
- `{ type: 'openFile', path }` / `{ type: 'openFolder', path }` — every rendered file/folder is a door

### State Management

No Redux/Context. App-level `useState<unknown>` holds server state, merged on each `stateUpdate` message. Views manage local UI state (selected tab, sort order, selected session) via component-local `useState`.

Session turns are **lazy-loaded**: initial state ships sessions with `turns: []`. When a user selects a session, webview sends `getSessionTurns` and the backend responds with the full turn array.

### Key Data Types (in `webview-ui/src/types.ts`)

- **Project** — `{ id, name, path, lastActive, isActive, sessionCount, totalTokens, totalCostUsd, techStack[] }`
- **Session** — `{ id, projectId, parentSessionId, startTime, endTime, durationMs, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, costUsd, promptCount, toolCallCount, filesModified[], filesCreated[], turns[], sessionSummary, hasThinking, thinkingTokens, cacheHitRate, subagentCostUsd, idleTimeMs, activeTimeMs, activityRatio, model }`
- **Turn** — `{ id, role, content, inputTokens, outputTokens, toolCalls[], timestamp, thinking? }`
- **ToolCall** — `{ id, name, input, output?, mcpServer? }`
- **ProjectConfig** — `{ claudeMd, mcpServers, projectSettings, commands[], memory, hooks[] }`
- **ProjectStats** — `{ usageOverTime[], toolUsage[], promptPatterns[], efficiency, recentToolCalls[], weeklyStats }`
- **DashboardStats** — `{ totalProjects, activeSessionCount, tokensTodayTotal, costTodayUsd, tokensWeekTotal, costWeekUsd }`
- **ProjectMemory** — `{ index, files: MemoryFile[] }` where `MemoryFile` = `{ name, description, type, content }`
- **SessionTodoSnapshot** — `{ sessionId, sessionDate, sessionSummary, todos: { content, status }[], timestamp }`
- **ClaudeCommit** — `{ hash, shortHash, author, date, subject, filesChanged }`
- **HookConfig** — `{ event, matcher?, command }`

Other types: `DailyUsage`, `ProjectUsage`, `HeatmapCell`, `PatternCount`, `ToolUsageStat`, `HotFile`, `ProjectedCost`, `StreakData`, `EfficiencyStats`, `WeeklyRecap`, `RecentFileChange`, `ProductivityHour`, `BudgetStatus`, `ProjectFile`, `ProjectToolCall`, `WeeklyProjectStats`, `McpServer`, `PromptSearchResult`, `SessionRow`. Session/SessionRow also carry `pricingConfidence: 'exact' | 'fallback'`.

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
5. **Render** in the appropriate tab (Home/Analytics/Sessions) in `Dashboard.tsx`

### Testing

- **Framework:** Vitest (both backend and frontend)
- **Frontend extras:** React Testing Library + jsdom
- **Coverage target:** 80% lines, 75% branches, 80% functions
- **Run:** `npm test` (backend) · `cd webview-ui && npm test` (frontend) · `npm run test:all` (both)
- **Structure:** Each source file has a co-located `__tests__/` directory
- **Fixtures:** `src/__tests__/fixtures/` and `webview-ui/src/__tests__/fixtures/`

### Not Yet Implemented

These Claude Code features are **not captured or displayed** by the dashboard:
- **Plans** — Implementation plans created during sessions (conversational, no persistent data)
- **Scheduled triggers** — cron-based remote agents (no local data source)
- **Worktrees** — isolated git worktrees created by subagents (visible in Tools tab as tool calls)
- **Session diff viewer** — `~/.claude/file-history/` before/after file changes
- **Prompt library** — starred/saved prompts and pattern detection
