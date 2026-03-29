# Data Sources & Calculations

How Claude Code Dashboard reads, parses, and calculates everything it displays.

---

## 1. Where the Data Lives

Claude Code stores all session data locally on disk at:

```
~/.claude/
├── settings.json                    # Global config — hooks, MCP servers, permissions
├── CLAUDE.md                        # Global instructions given to Claude on every session
├── sessions/                        # Live session metadata (one file per running session)
│   └── {session-uuid}.json
└── projects/
    └── {encoded-project-path}/      # One directory per project
        ├── {session-uuid}.jsonl     # One file per session
        ├── {session-uuid}.jsonl
        └── subagents/               # Sessions spawned via the Task/Agent tool
            └── {session-uuid}.jsonl
```

The extension also writes one file of its own (with user consent):

```
~/.claude/
├── .dashboard-events.jsonl          # Live hook events appended by injected hooks
└── settings.json.bak                # Backup made before hook injection
```

And uses VS Code's extension storage for the startup cache:

```
~/Library/Application Support/Code/User/globalStorage/
└── claude-code-dashboard/
    └── project-cache.json           # Parsed session cache (speeds up restarts)
```

### Project Directory Naming

Claude encodes the project path by replacing every `/` with `-`. For example:

```
/Users/john/projects/my-app  →  -Users-john-projects-my-app
```

This encoding is ambiguous (a `-` in a folder name looks the same as a `/`), so we don't decode the directory name directly. Instead we read the `cwd` field from inside the JSONL file, which contains the exact original path.

---

## 2. Session File Format (JSONL)

Each session is a `.jsonl` file — one JSON object per line. There are several entry types:

### `type: "user"` — User's prompt

```json
{
  "type": "user",
  "uuid": "62e5ff4e-...",
  "timestamp": "2026-03-04T14:45:41.153Z",
  "sessionId": "2d706bab-...",
  "cwd": "/Users/john/projects/my-app",
  "message": {
    "role": "user",
    "content": "Fix the login bug"
  }
}
```

- `content` is either a plain string or an array of content blocks
- Array blocks can be `type: "text"` (visible prompt) or `type: "tool_result"` (tool output fed back)
- We only extract `type: "text"` blocks to show the user's actual message
- Internal slash commands are wrapped in `<command-message>` tags and stripped from display
- The **first** non-empty user prompt is stored as `sessionSummary` (truncated to 120 chars) — this is the "what was I doing?" preview shown in the session list

### `type: "assistant"` — Claude's response

```json
{
  "type": "assistant",
  "uuid": "8856acfe-...",
  "timestamp": "2026-03-04T14:45:43.045Z",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-6",
    "stop_reason": "end_turn",
    "content": [
      { "type": "text", "text": "I'll fix that now." },
      {
        "type": "thinking",
        "thinking": "Let me reason through this...",
        "thinking_tokens": 800
      },
      {
        "type": "tool_use",
        "id": "toolu_01...",
        "name": "Edit",
        "input": { "file_path": "src/auth.ts", "old_string": "...", "new_string": "..." }
      }
    ],
    "usage": {
      "input_tokens": 42,
      "cache_creation_input_tokens": 18500,
      "cache_read_input_tokens": 312000,
      "output_tokens": 284
    }
  }
}
```

This is the richest entry type. It contains:
- The model used (`claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`, etc.)
- All token counts (see section 3)
- Every tool call Claude made in this turn
- Optional `type: "thinking"` blocks when extended thinking is enabled
- `stop_reason`: `"end_turn"` (finished), `"tool_use"` (called a tool, waiting for result)

### `type: "thinking"` content blocks

When Claude uses extended thinking mode, assistant turns contain one or more `type: "thinking"` blocks before the text response:

```json
{ "type": "thinking", "thinking": "...", "thinking_tokens": 800 }
```

- Their presence sets `hasThinking: true` on the session
- `thinking_tokens` values are summed into `thinkingTokens` on the session
- A ⚡ badge is shown in the session list and detail for sessions that used extended thinking

### Other entry types (ignored for display)

- `type: "queue-operation"` — internal session queue management
- `type: "file-history-snapshot"` — file state tracking for undo
- `type: "summary"` — auto-generated session summaries (in some versions)

---

## 3. Token Fields

Every assistant turn reports 4 token counts in `message.usage`:

| Field | What it means | Typical size |
|---|---|---|
| `input_tokens` | Fresh, uncached input tokens for this turn | Small (3–200) |
| `cache_creation_input_tokens` | New context written to Claude's prompt cache | Medium (500–20k) |
| `cache_read_input_tokens` | Context re-read from cache (all prior turns, files, etc.) | **Large** (10k–500k per turn) |
| `output_tokens` | Tokens Claude generated in its response | Small–Medium (50–2000) |

### Why cache_read_input_tokens is huge

Claude Code uses prompt caching aggressively. The entire conversation history + all file contents Claude has read are cached. On every turn, all of that context is re-read from cache — which can be 300,000+ tokens per turn in a long session. Summed across a session, this inflates the raw token count to 10–20 million.

### What we display as "total tokens"

We intentionally **exclude** `cache_read_input_tokens` from the displayed token count:

```
totalTokens = input_tokens + cache_creation_input_tokens + output_tokens
```

This gives a meaningful number that reflects the actual new content processed, not the repeated re-reads. Cache reads are shown separately as "+17.3M cached" in session details.

### Cache hit rate

```
cacheHitRate = cacheReadTokens / (inputTokens + cacheCreationTokens + cacheReadTokens) × 100
```

Expressed as a percentage and shown in green in the session detail bar. A high rate (>90%) means Claude is efficiently reusing context rather than reprocessing it cold.

---

## 4. Cost Calculation

Cost is estimated locally using all 4 token types, a bundled pricing table, and a heuristic model-family mapping. It is intended to be directionally useful inside the dashboard and may not exactly match Anthropic billing.

### Pricing rates (per 1M tokens)

| Model | Input | Cache Write | Cache Read | Output |
|---|---|---|---|---|
| claude-opus-4 | $15.00 | $18.75 | $1.50 | $75.00 |
| claude-sonnet-4 | $3.00 | $3.75 | $0.30 | $15.00 |
| claude-haiku-4 | $0.80 | $1.00 | $0.08 | $4.00 |

### Formula

```
cost = (input_tokens        × input_rate      / 1,000,000)
     + (cache_creation      × cache_write_rate / 1,000,000)
     + (cache_read          × cache_read_rate  / 1,000,000)
     + (output_tokens       × output_rate      / 1,000,000)
```

**Example** — a typical long session:
```
input_tokens:          18,818  × $3.00   = $0.056
cache_creation:       952,174  × $3.75   = $3.571
cache_read:        17,302,204  × $0.30   = $5.191
output_tokens:        108,237  × $15.00  = $1.624
                               TOTAL     = $10.44
```

Note: cache read is the dominant cost driver in long sessions, even at 0.1× the input rate.

### Model detection

The model name is read from `message.model` on each assistant turn (e.g. `"claude-sonnet-4-6"`). We map it to a pricing tier heuristically:
- Contains `"opus"` → claude-opus-4 rates
- Contains `"haiku"` → claude-haiku-4 rates
- Everything else → claude-sonnet-4 rates (default)

This means unknown or future model names currently fall back to Sonnet pricing unless they contain `opus` or `haiku`.

---

## 5. Session Metadata

### Session ID
The filename without `.jsonl` extension — a UUID generated by Claude Code (e.g. `2d706bab-1182-4d3e-a7d4-c4bbaef4d1d7`).

### Project path (cwd)
Read directly from the `cwd` field present on every `user` and `assistant` entry. More reliable than decoding the directory name.

### Start time
Timestamp of the first `type: "user"` entry with a valid timestamp.

### End time
Timestamp of the last entry in the file. Set to `null` if the session is currently active.

### Duration
`endTime - startTime` in milliseconds. `null` for active sessions.

### Active session detection

Two mechanisms are used, in order of preference:

**1. Process-based detection (preferred)** — Claude writes a metadata file to `~/.claude/sessions/` for every running session:

```json
{ "pid": 12345, "sessionId": "2d706bab-...", "cwd": "/Users/john/my-app", "startedAt": "..." }
```

We read all files in that directory and call `process.kill(pid, 0)` on each PID. Signal 0 does not kill the process — it only checks whether it is alive. Sessions whose PID is alive are marked `isActiveSession: true`. Sessions whose PID is not found are marked `false`.

This check is performed once at the start of each scan (not once per project) and its result is applied to all sessions.

**2. Time-based heuristic (fallback)** — If `~/.claude/sessions/` does not exist (older Claude versions), a session is considered active if the last entry's timestamp is within the past 30 minutes. We cannot use `stop_reason` for this because Claude writes `"end_turn"` after every response — a session sitting idle waiting for the next user message appears "complete" by that metric.

### Session summary
The first non-empty user prompt in the session, stripped of `<command-message>` tags and truncated to 120 characters. Stored on the session object at parse time and shown as an italic preview line in the session list.

### Extended thinking
`hasThinking: true` if any assistant turn contains a `type: "thinking"` content block. `thinkingTokens` sums any `thinking_tokens` values reported on those blocks.

### Cache hit rate
See section 3. Computed per session at parse time.

### Prompt count
Number of `type: "user"` turns with non-empty display content.

### Tool call count
Number of `type: "tool_use"` content blocks across all assistant turns.

### Files modified / created
Extracted from tool call inputs:
- `Write` tool → `file_path` added to **created** set
- `Edit` or `MultiEdit` tool → `file_path` added to **modified** set

Both sets are deduplicated. A file appears once even if edited multiple times in a session.

### Subagent cost
Each project directory may contain a `subagents/` subdirectory holding JSONL files for sessions that Claude spawned via the `Task` / `Agent` tool. These are parsed using the same `SessionParser`. We scan the first entries of each subagent file for `parentSessionId` / `parent_session_id` / `parentId` to link the cost to the specific parent session. If no parent link is found, cost is attributed to the most recently started session in the project.

---

## 6. Startup Cache

Parsing hundreds of JSONL files on every VS Code restart adds latency. We cache parsed results in:

```
{globalStorageUri}/project-cache.json
```

### Format

```json
{
  "version": 2,
  "entries": {
    "{projectId}": {
      "cachedAt": 1741234567890,
      "project": { ... },
      "sessions": [ ... ]
    }
  }
}
```

### Cache validation

On every project load we compare the cache's `cachedAt` timestamp against the `mtime` of every JSONL file in the project directory. If no JSONL is newer than `cachedAt`, the cached `project` and `sessions` objects are used as-is and the files are not re-read.

`isActiveSession` is **never** served from cache. It is always recomputed from process state (or the 30-minute heuristic) on every load since it reflects runtime conditions, not file content.

### Cache invalidation

- Any JSONL file newer than `cachedAt` triggers a full re-parse of that project
- `version` is checked on load; a version mismatch (e.g. after an extension update that adds new parsed fields) discards the entire cache and rebuilds it

---

## 7. Real-Time Updates

### File watching
We use Node.js `fs.watch({ recursive: true })` on `~/.claude/projects/`. This uses macOS FSEvents — low latency, no polling.

> Note: `vscode.workspace.createFileSystemWatcher` only watches files inside the open workspace folder and does NOT work for `~/.claude/` which is always outside the workspace.

When a session JSONL is written to (i.e. a turn completes), the watcher fires. We debounce 300ms per file to handle rapid consecutive writes within a single turn, then re-parse the full project. The cache is updated and saved to disk after each re-parse.

### Hook events
If hooks are configured, Claude Code runs a shell command after every tool use and session stop. The hook appends a small JSON event to `~/.claude/.dashboard-events.jsonl`. The extension polls this file every 500ms for sub-second live updates during active sessions.

Hook entries look like:
```json
{ "type": "tool_use", "tool": "Edit", "projectId": "...", "timestamp": 1234567890 }
{ "type": "session_stop", "projectId": "...", "timestamp": 1234567890 }
```

### Debouncing
The store debounces `emit('updated')` to 200ms so that rapid file changes (e.g. multiple sessions updating simultaneously) result in a single UI refresh rather than many.

---

## 8. Budget Alerts

Two independent budget settings are supported:

| Setting | Type | Behaviour |
|---|---|---|
| `claudeDashboard.monthlyTokenBudget` | token count | Alert once per day when monthly tokens exceed the limit |
| `claudeDashboard.monthlyBudgetUsd` | USD amount | Alert once per day at 80% used; alert again once per day at 100% |

Alert timestamps are persisted in VS Code `globalState` (`lastBudgetAlert`, `lastCostBudget80Alert`, `lastCostBudgetExceededAlert`) to enforce the once-per-day rate limit independently for each threshold.

The budget banner in the Dashboard Overview tab also reflects the current spend vs limit in real time (yellow at ≥80%, red at ≥100%), computed fresh from `store.getMonthlyUsage()` on every state update.

---

## 9. Project Configuration Data

### CLAUDE.md
Read from `{project-path}/CLAUDE.md` (project-level) and `~/.claude/CLAUDE.md` (global). These contain the instructions given to Claude at the start of every session in that project.

### MCP Servers
Read from `~/.claude/settings.json` (global) and `{project-path}/.claude/settings.json` (project-level) under the `mcpServers` key. Project-level settings override global ones.

### Tech stack detection
Inferred by checking which config files exist in the project root:
- `package.json` → Node.js
- `tsconfig.json` → TypeScript
- `pyproject.toml` or `requirements.txt` → Python
- `go.mod` → Go
- `Cargo.toml` → Rust

---

## 10. Derived Analytics

All analytics are computed in-memory from the parsed session data. Nothing is stored in a database.

### Global (across all projects)

| Metric | How it's computed |
|---|---|
| **Tokens today** | Sum `totalTokens` for sessions where `startTime` > midnight today |
| **Cost today** | Sum estimated session cost for sessions where `startTime` > midnight today, including attributed `subagentCostUsd` |
| **Usage over time** | Group sessions by calendar day, sum tokens and estimated cost per day |
| **Hot files** | Count occurrences of each path across all sessions' `filesModified` arrays, across all projects |
| **Tool usage** | Count each `toolCall.name` across all turns in all sessions |
| **Streak** | Build a set of unique calendar dates with any session activity, walk backwards from today |
| **Efficiency — avg tokens/prompt** | `totalTokens / promptCount` across all sessions |
| **Efficiency — first-turn resolution** | % of sessions where `promptCount === 1` |
| **Projected monthly cost** | `(currentMonthCost / daysElapsed) × daysInMonth`, using estimated cost including attributed `subagentCostUsd` |
| **Productivity by hour** | Group sessions by `new Date(startTime).getHours()`, average tool calls and files modified |
| **Heatmap** | Group sessions by `[dayOfWeek, hour]`, sum tokens per cell |
| **Prompt patterns** | Classify each user turn by keyword regex into: Fix/Bug, Explain, Refactor, Feature, Test, Other |
| **Cache hit rate** | Per session: `cacheRead / (input + cacheCreation + cacheRead) × 100` |
| **Monthly usage** | Sum `totalTokens` and estimated session cost (including `subagentCostUsd`) for sessions since the 1st of the current month |

### Per-project

All global metrics can be re-computed scoped to a single project's sessions. The project Stats tab uses:

| Metric | How it's computed |
|---|---|
| **Usage over time (30d)** | Same as global but iterates only the target project's sessions |
| **Tool usage** | Count tool calls only from sessions in this project |
| **Prompt patterns** | Classify user turns only from sessions in this project |
| **Efficiency stats** | Same formulas as global, scoped to this project |
| **Recent tool calls** | All tool calls from all sessions, sorted newest-first, capped at 60 |

### Per-project files

| Metric | How it's computed |
|---|---|
| **File list** | Deduplicate all `filesModified` and `filesCreated` paths across all sessions |
| **Edit count** | Number of sessions that touched the file |
| **Type** | `"created"` if only in `filesCreated`; `"modified"` if only in `filesModified`; `"both"` if seen in both across different sessions |
| **Last touched** | `startTime` of the most recent session that included the file |
