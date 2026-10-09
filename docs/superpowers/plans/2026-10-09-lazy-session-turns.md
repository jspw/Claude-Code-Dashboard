# Lazy Session Turns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep only small per-session summaries in memory and in the disk cache, read a session's full turns from its JSONL only when it is opened, exported or shared, and re-parse only the file that changed.

**Architecture:** `SessionParser` attaches a `SessionDigest` to every session — exactly the slices of its turns that the analytics read. `DashboardStore` holds sessions with `turns: []` plus that digest, serves full turns on demand through `getSessionTurns()` backed by a 3-entry LRU, caches parsed sessions per file (keyed by mtime + size) so a change re-parses one file, and writes a turn-free cache asynchronously through a temp file and rename.

**Tech Stack:** TypeScript (strict), Node `fs` / `fs.promises`, VS Code extension API, Vitest.

**Spec:** No separate spec — the measured problem and the decisions are under Background.

## Background (measured 2026-10-09 on the author's machine)

- 636 MB of JSONL across 48 projects. Every session of every project is held in the extension host with all its turns; the cache plus two projects alone reached ~600 MB of heap.
- The disk cache is 51.5 MB (479 of 491 sessions stored with full turns) and is rewritten synchronously — ~180 ms — on every session-file change.
- A change to any session re-parses every session in its project (~780 ms for a 156 MB project), because the cache check compares one project-wide mtime.
- Everything that reads turns needs only these slices, none of which include tool output, assistant text or thinking:

| Consumer (`DashboardStore`) | Reads |
|---|---|
| `searchPrompts`, `getAllPrompts`, `getPromptPatterns`, `getProjectStats` patterns | user turns |
| `getToolUsageStats`, `getWeeklyRecap`, `getProjectStats` tool usage | tool-name counts |
| `getProjectConfig` MCP stats | MCP-server counts |
| `getProjectTodos` | last `TodoWrite` with `todos` |
| `getProjectStats` recent calls | 60 newest tool calls (name, input, timestamp) |
| `loadProject` last-active | last turn timestamp |

Full turns are needed only to show one session (`ProjectPanel`), export sessions as JSON (`extension.ts`), or share (`src/share/`).

## Global Constraints

- Prerequisite: commit the current uncommitted work (agent context sharing and the fixes made alongside it) before Task 1, so each task below lands as its own commit.
- Tests always capped: `npx vitest run --maxWorkers=2` at the repo root, `cd webview-ui && npx vitest run --maxWorkers=2`. Never uncapped.
- Coverage gate unchanged: 80% lines, 75% branches, 80% functions.
- No new dependencies.
- Every analytics getter keeps its current output: existing `DashboardStore` test expectations are not edited, except where Task 5 changes the cache file format they seed.
- Webview payloads never carry `digest` or `sourceFile`; sessions still ship with `turns: []`.
- Exported JSON keeps today's shape: full turns, no `digest` or `sourceFile`.

## Review Focus

1. The live session — the one Claude is writing to right now — must show its current turns after a change, never a cached copy (Task 4: a file change drops that session's cached turns).
2. A session file deleted or moved after loading must open as "No turns recorded", not throw (Task 4: missing-file test).
3. Several VS Code windows share one cache file; a half-written or corrupt cache must never break loading (Task 5: per-process temp file + rename, corrupt-cache test).
4. Upgrading with an old 51 MB version-2 cache on disk must discard it, not misread it (Task 5: version test).
5. Re-opening the same huge session must parse it once and serve it from memory afterwards (Task 4: LRU-hit test).

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/parsers/sessionDigest.ts` | Create | `SessionDigest` type and pure `digestTurns()` |
| `src/parsers/SessionParser.ts` | Modify | attach `digest` and `sourceFile` to parsed sessions |
| `src/store/DashboardStore.ts` | Modify | `Session.digest` / `sourceFile`; getters read digests; turns dropped after parse; `getSessionTurns()` with LRU; per-file cache v3; async cache save |
| `src/webviews/ProjectPanel.ts` | Modify | sessions sent without `digest`/`sourceFile`; turns come from the store |
| `src/share/buildBundle.ts` | Modify | `turnsFor` callback so one session's turns are in memory at a time |
| `src/share/shareContext.ts` | Modify | turns come from the store |
| `src/extension.ts` | Modify | JSON export loads turns on demand |
| `src/__tests__/fixtures/sessions.ts` | Modify | fixture sessions derive their digest from their turns |
| `CLAUDE.md` | Modify | describe turns loading from disk on demand |

---

### Task 1: Session digest

**Files:**
- Create: `src/parsers/sessionDigest.ts`
- Test: `src/parsers/__tests__/sessionDigest.test.ts`

**Interfaces:**
- Consumes: `Turn` type from `src/store/DashboardStore.ts` (type-only import).
- Produces: `interface SessionDigest`, `interface RecentToolCall`, `const RECENT_TOOL_CALLS = 60`, `function digestTurns(turns: Turn[]): SessionDigest`.

- [ ] **Step 1: Write the failing test**

```ts
// src/parsers/__tests__/sessionDigest.test.ts
import { describe, expect, it } from 'vitest';
import { digestTurns, RECENT_TOOL_CALLS } from '../sessionDigest';
import { makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

describe('digestTurns', () => {
  it('keeps user turns and counts tools and MCP servers', () => {
    const digest = digestTurns([
      makeTurn({ id: 'u1', role: 'user', content: 'Fix it', timestamp: 1 }),
      makeTurn({ role: 'assistant', timestamp: 2, toolCalls: [
        makeToolCall({ name: 'Read' }),
        makeToolCall({ name: 'mcp__github__search', mcpServer: 'github' }),
      ] }),
      makeTurn({ role: 'assistant', timestamp: 3, toolCalls: [makeToolCall({ name: 'Read' })] }),
    ]);

    expect(digest.userTurns.map(t => t.id)).toEqual(['u1']);
    expect(digest.toolCounts).toEqual({ Read: 2, mcp__github__search: 1 });
    expect(digest.mcpCounts).toEqual({ github: 1 });
    expect(digest.lastTurnAt).toBe(3);
  });

  it('keeps the final TodoWrite state', () => {
    const todo = (content: string) => makeToolCall({ name: 'TodoWrite', input: { todos: [{ content, status: 'pending' }] } });
    const digest = digestTurns([
      makeTurn({ role: 'assistant', timestamp: 1, toolCalls: [todo('first')] }),
      makeTurn({ role: 'assistant', timestamp: 2, toolCalls: [todo('second')] }),
    ]);

    expect(digest.lastTodos).toEqual({ todos: [{ content: 'second', status: 'pending' }], timestamp: 2 });
  });

  it('keeps only the newest tool calls, newest first', () => {
    const turns = Array.from({ length: RECENT_TOOL_CALLS + 5 }, (_, i) =>
      makeTurn({ role: 'assistant', timestamp: i, toolCalls: [makeToolCall({ name: `T${i}` })] }));
    const digest = digestTurns(turns);

    expect(digest.recentToolCalls).toHaveLength(RECENT_TOOL_CALLS);
    expect(digest.recentToolCalls[0]).toMatchObject({ tool: `T${RECENT_TOOL_CALLS + 4}`, timestamp: RECENT_TOOL_CALLS + 4 });
  });

  it('describes an empty session', () => {
    expect(digestTurns([])).toEqual({
      userTurns: [], toolCounts: {}, mcpCounts: {}, lastTodos: null, recentToolCalls: [], lastTurnAt: null,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --maxWorkers=2 src/parsers/__tests__/sessionDigest.test.ts`
Expected: FAIL — `Failed to resolve import "../sessionDigest"`.

- [ ] **Step 3: Implement**

```ts
// src/parsers/sessionDigest.ts
import type { Turn } from '../store/DashboardStore';

export const RECENT_TOOL_CALLS = 60;

export interface RecentToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: number;
}

/**
 * Everything the dashboard's analytics read from a session's turns. Holding
 * this instead of the turns keeps tool output, assistant text and thinking —
 * nearly all of the bytes — on disk until someone opens the session.
 */
export interface SessionDigest {
  userTurns: Turn[];                                         // prompt search, all prompts, prompt patterns
  toolCounts: Record<string, number>;                        // tool usage, weekly recap, project stats
  mcpCounts: Record<string, number>;                         // MCP server call counts
  lastTodos: { todos: unknown[]; timestamp: number } | null; // final TodoWrite state
  recentToolCalls: RecentToolCall[];                         // newest first, at most RECENT_TOOL_CALLS
  lastTurnAt: number | null;                                 // project "last active"
}

export function digestTurns(turns: Turn[]): SessionDigest {
  const toolCounts: Record<string, number> = {};
  const mcpCounts: Record<string, number> = {};
  const calls: RecentToolCall[] = [];
  let lastTodos: SessionDigest['lastTodos'] = null;

  for (const turn of turns) {
    for (const tc of turn.toolCalls) {
      toolCounts[tc.name] = (toolCounts[tc.name] ?? 0) + 1;
      if (tc.mcpServer) { mcpCounts[tc.mcpServer] = (mcpCounts[tc.mcpServer] ?? 0) + 1; }
      if (tc.name === 'TodoWrite' && Array.isArray(tc.input?.todos)) {
        lastTodos = { todos: tc.input.todos as unknown[], timestamp: turn.timestamp };
      }
      calls.push({ tool: tc.name, input: tc.input, timestamp: turn.timestamp });
    }
  }

  calls.sort((a, b) => b.timestamp - a.timestamp);
  return {
    userTurns: turns.filter(t => t.role === 'user'),
    toolCounts,
    mcpCounts,
    lastTodos,
    recentToolCalls: calls.slice(0, RECENT_TOOL_CALLS),
    lastTurnAt: turns.length > 0 ? turns[turns.length - 1].timestamp : null,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --maxWorkers=2 src/parsers/__tests__/sessionDigest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/parsers/sessionDigest.ts src/parsers/__tests__/sessionDigest.test.ts
git commit -m "feat(store): add per-session digest of what analytics read from turns"
```

---

### Task 2: Every session carries its digest and source file

**Files:**
- Modify: `src/store/DashboardStore.ts:84-114` (`Session` interface)
- Modify: `src/parsers/SessionParser.ts:285-316` (object returned by `parseFile`)
- Modify: `src/__tests__/fixtures/sessions.ts` (`makeSession`)
- Modify: `src/webviews/ProjectPanel.ts` (`buildState`)
- Test: `src/parsers/__tests__/SessionParser.test.ts`, `src/webviews/__tests__/ProjectPanel.test.ts`

**Interfaces:**
- Consumes: `digestTurns`, `SessionDigest` (Task 1).
- Produces: `Session.digest: SessionDigest`, `Session.sourceFile: string | null`.

- [ ] **Step 1: Write the failing tests**

Add to `src/parsers/__tests__/SessionParser.test.ts` (the file already imports `SESSION_WITH_TOOLS` and defines `asReadResult`), with `import { digestTurns } from '../sessionDigest';` at the top:

```ts
  it('attaches a digest and the source file to each parsed session', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(SESSION_WITH_TOOLS));
    const result = parser.parseFile('/sessions/tools.jsonl', 'proj-1');

    expect(result?.sourceFile).toBe('/sessions/tools.jsonl');
    expect(result?.digest).toEqual(digestTurns(result!.turns));
    expect(Object.keys(result!.digest.toolCounts).length).toBeGreaterThan(0);
  });
```

Add to `src/webviews/__tests__/ProjectPanel.test.ts`:

```ts
  it('sends sessions to the webview without turns, digest or source file', () => {
    let updatedHandler: () => void = () => {};
    const session = { id: 's1', startTime: 1, turns: [{ id: 't1' }], digest: { userTurns: [] }, sourceFile: '/x/s1.jsonl' };
    const store = {
      on: vi.fn((evt, cb) => { if (evt === 'updated') updatedHandler = cb; }),
      off: vi.fn(),
      getProject: vi.fn(() => undefined),
      getSessions: vi.fn(() => [session]),
      getSubagentSessions: vi.fn(() => [session]),
      getProjectConfig: vi.fn(() => ({})),
      getProjectStats: vi.fn(() => ({})),
      getProjectFiles: vi.fn(() => []),
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
    };
    const panel = {
      webview: { html: '', postMessage: vi.fn(), onDidReceiveMessage: vi.fn(), asWebviewUri: vi.fn((u) => u), cspSource: 'test' },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);
    const context = { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext;

    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'p1');
    updatedHandler();

    const { payload } = panel.webview.postMessage.mock.calls[0][0];
    for (const sent of [...payload.sessions, ...payload.subagentSessions]) {
      expect(sent).toEqual({ id: 's1', startTime: 1, turns: [] });
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/parsers/__tests__/SessionParser.test.ts src/webviews/__tests__/ProjectPanel.test.ts`
Expected: FAIL — `sourceFile` is `undefined`; the sent session still contains `digest` and `sourceFile`.

- [ ] **Step 3: Implement**

In `src/store/DashboardStore.ts` add the import and two fields at the end of `Session`:

```ts
import type { SessionDigest } from '../parsers/sessionDigest';
```

```ts
  pricingConfidence?: 'exact' | 'fallback'; // 'fallback' = unknown model, priced at Sonnet rates
  digest: SessionDigest;          // what analytics read from turns, so turns can stay on disk
  sourceFile: string | null;      // JSONL this session was parsed from; turns are re-read from it
}
```

In `src/parsers/SessionParser.ts` import `digestTurns` from `./sessionDigest` and add two properties after `pricingConfidence,` in the object `parseFile` returns:

```ts
        pricingConfidence,
        digest: digestTurns(turns),
        sourceFile: filePath,
      };
```

In `src/__tests__/fixtures/sessions.ts`, import `digestTurns` from `../../parsers/sessionDigest` and make `makeSession` derive the digest from whatever turns the test supplies. Keep every existing default; only the two new fields and the return change:

```ts
export function makeSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  const session: Session = {
    // …every existing default, unchanged…
    model: null,
    digest: digestTurns([]),
    sourceFile: null,
    ...overrides,
  };
  // Analytics read the digest, so keep it in step with the turns a test supplies.
  return overrides.digest ? session : { ...session, digest: digestTurns(session.turns) };
}
```

In `src/webviews/ProjectPanel.ts` import `Session` and change the two stripping lines in `buildState`:

```ts
import { DashboardStore, Session } from '../store/DashboardStore';

// Turns load on demand, and the digest and source path are backend-only.
function toWireSession({ digest: _digest, sourceFile: _sourceFile, ...session }: Session) {
  return { ...session, turns: [] };
}
```

```ts
    const sessions = store.getSessions(projectId).map(toWireSession);
    const subagentSessions = store.getSubagentSessions(projectId).map(toWireSession);
```

Run `npx tsc --noEmit -p .`. Any object literal typed `Session` that now fails to compile gets `digest: digestTurns(<its turns>)` and `sourceFile: null`.

- [ ] **Step 4: Run everything to verify it passes**

Run: `npx vitest run --maxWorkers=2 && npx tsc --noEmit -p .`
Expected: all backend tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/DashboardStore.ts src/parsers/SessionParser.ts src/__tests__/fixtures/sessions.ts src/webviews/ProjectPanel.ts src/parsers/__tests__/SessionParser.test.ts src/webviews/__tests__/ProjectPanel.test.ts
git commit -m "feat(store): attach digest and source file to every parsed session"
```

---

### Task 3: Analytics read digests, not turns

**Files:**
- Modify: `src/store/DashboardStore.ts` — `searchPrompts`, `getPromptPatterns`, `getProjectConfig` (MCP counts), `getProjectTodos`, `getAllPrompts`, `getToolUsageStats`, `getWeeklyRecap`, `getProjectStats`, `loadProject` (last active)
- Test: `src/store/__tests__/DashboardStore.test.ts`

**Interfaces:**
- Consumes: `Session.digest` (Task 2).
- Produces: no new API; every getter's output is unchanged.

- [ ] **Step 1: Write the failing test**

Add inside `describe('DashboardStore', …)` (`NOW`, `HOUR` and the fixtures are in scope; add `makeToolCall` to the fixture import if missing, and import `digestTurns` from `../../parsers/sessionDigest`):

```ts
  it('computes analytics from session digests alone', () => {
    const store = new DashboardStore('/claude');
    const turns = [
      makeTurn({ role: 'user', content: 'Fix the login bug', timestamp: NOW - HOUR }),
      makeTurn({ role: 'assistant', timestamp: NOW - HOUR + 1, toolCalls: [makeToolCall({ name: 'Edit' })] }),
    ];
    const session = makeSession({ id: 'd1', projectId: 'p1', startTime: NOW - HOUR, turns: [], digest: digestTurns(turns) });
    (store as any).projects.set('p1', makeProject({ id: 'p1', name: 'Alpha' }));
    (store as any).sessions.set('p1', [session]);

    expect(store.getToolUsageStats()).toEqual([expect.objectContaining({ tool: 'Edit', count: 1 })]);
    expect(store.searchPrompts('login')).toHaveLength(1);
    expect(store.getPromptPatterns().find(p => p.category === 'Fix/Bug')?.count).toBe(1);
    expect(store.getProjectStats('p1').recentToolCalls[0]).toMatchObject({ tool: 'Edit', sessionId: 'd1' });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --maxWorkers=2 src/store/__tests__/DashboardStore.test.ts -t "digests alone"`
Expected: FAIL — `getToolUsageStats()` returns `[]` because it walks the empty `turns`.

- [ ] **Step 3: Implement — replace each turn walk**

`searchPrompts` — iterate `session.digest.userTurns` and drop the role check:

```ts
        for (const turn of session.digest.userTurns) {
          const content = turn.content.toLowerCase();
```

`getPromptPatterns` and `getAllPrompts`:

```ts
        for (const turn of session.digest.userTurns) {
          if (!turn.content) { continue; }
```

The prompt-pattern loop in `getProjectStats` (its variables are `s` and `t`):

```ts
    for (const s of sessions) {
      for (const t of s.digest.userTurns) {
        if (!t.content) { continue; }
```

`getProjectConfig` MCP counts:

```ts
    for (const session of allSessions) {
      for (const [server, count] of Object.entries(session.digest.mcpCounts)) {
        if (mcpServers[server]) { mcpServers[server].toolCallCount += count; }
      }
    }
```

`getProjectTodos` — replace the turn walk and the `lastTodoCall` checks:

```ts
    for (const session of sessions) {
      const last = session.digest.lastTodos;
      if (!last) { continue; }
      const todos = (last.todos as Array<{ content?: string; status?: string }>)
        .map(t => ({ content: t.content ?? '', status: t.status ?? 'pending' }));
      results.push({
        sessionId: session.id,
        sessionDate: session.startTime,
        sessionSummary: session.sessionSummary,
        todos,
        timestamp: last.timestamp,
      });
    }
```

`getToolUsageStats` (map `counts`, total `total`):

```ts
      for (const session of sessions) {
        for (const [tool, count] of Object.entries(session.digest.toolCounts)) {
          counts.set(tool, (counts.get(tool) ?? 0) + count);
          total += count;
        }
      }
```

`getWeeklyRecap` (map `toolCounts`):

```ts
        for (const [tool, count] of Object.entries(session.digest.toolCounts)) {
          toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + count);
        }
```

`getProjectStats` tool usage (map `toolCounts`, total `totalTools`):

```ts
    for (const s of sessions) {
      for (const [tool, count] of Object.entries(s.digest.toolCounts)) {
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + count);
        totalTools += count;
      }
    }
```

`getProjectStats` recent tool calls — each session already holds its newest 60, so the project's newest 60 are among them:

```ts
    for (const s of sessions) {
      for (const call of s.digest.recentToolCalls) {
        allCalls.push({ ...call, sessionId: s.id, sessionDate: s.startTime });
      }
    }
```

`loadProject` last active:

```ts
          const sessionLatest = session.endTime ?? session.digest.lastTurnAt ?? session.startTime;
```

Then confirm nothing in the store still walks turns: `grep -n "\.turns" src/store/DashboardStore.ts` must print nothing.

- [ ] **Step 4: Run everything to verify it passes**

Run: `npx vitest run --maxWorkers=2 && npx tsc --noEmit -p .`
Expected: all PASS, including every pre-existing analytics test with unedited expectations.

- [ ] **Step 5: Commit**

```bash
git add src/store/DashboardStore.ts src/store/__tests__/DashboardStore.test.ts
git commit -m "refactor(store): compute analytics from session digests"
```

---

### Task 4: Turns load from disk on demand

**Files:**
- Modify: `src/store/DashboardStore.ts` — drop turns after parsing; add `getSessionTurns()`, a turn LRU, invalidation in `onFileChanged`
- Modify: `src/webviews/ProjectPanel.ts` — `getSessionTurns` message
- Modify: `src/share/buildBundle.ts`, `src/share/shareContext.ts`, `src/extension.ts`
- Modify: `CLAUDE.md` — State Management paragraph on lazy turns
- Test: `src/store/__tests__/DashboardStore.test.ts`, `src/webviews/__tests__/ProjectPanel.test.ts`, `src/share/__tests__/buildBundle.test.ts`, `src/share/__tests__/shareContext.test.ts`, `src/__tests__/extension.test.ts`

**Interfaces:**
- Consumes: `Session.sourceFile`, `Session.digest` (Task 2), digest-based getters (Task 3).
- Produces: `DashboardStore.getSessionTurns(projectId: string, sessionId: string): Turn[]`; `buildBundle(project, config, sessions, generatedAt?, turnsFor?: (session: Session) => Turn[])`.

- [ ] **Step 1: Write the failing store tests**

```ts
  describe('turns on demand', () => {
    const FILE = '/claude/projects/p1/s1.jsonl';
    const storeWith = (session = makeSession({ id: 's1', projectId: 'p1', turns: [], sourceFile: FILE })) => {
      const store = new DashboardStore('/claude');
      (store as any).sessions.set('p1', [session]);
      return store;
    };

    it('keeps no turns in memory after loading a project', async () => {
      const store = new DashboardStore('/claude');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readdirSync).mockReturnValue(['s1.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1, size: 10 } as fs.Stats);
      vi.spyOn((store as any).sessionParser, 'parseFile').mockReturnValue(makeSession({ id: 's1', turns: [makeTurn()] }));

      await (store as any).loadProject('p1', '/claude/projects/p1', { ids: new Set(), available: true });

      const [session] = store.getSessions('p1');
      expect(session.turns).toEqual([]);
      expect(session.digest.userTurns).toHaveLength(1);
    });

    it('parses a session once, then serves it from memory', () => {
      const store = storeWith();
      const parseFile = vi.spyOn((store as any).sessionParser, 'parseFile')
        .mockReturnValue(makeSession({ turns: [makeTurn({ id: 'loaded' })] }));

      expect(store.getSessionTurns('p1', 's1').map(t => t.id)).toEqual(['loaded']);
      store.getSessionTurns('p1', 's1');
      expect(parseFile).toHaveBeenCalledTimes(1);
    });

    it('re-reads a session after its file changes', async () => {
      const store = storeWith();
      vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
      const parseFile = vi.spyOn((store as any).sessionParser, 'parseFile')
        .mockReturnValue(makeSession({ turns: [makeTurn()] }));

      store.getSessionTurns('p1', 's1');
      await store.onFileChanged(FILE);
      store.getSessionTurns('p1', 's1');
      expect(parseFile).toHaveBeenCalledTimes(2);
    });

    it('returns no turns when the session or its file is gone', () => {
      const store = storeWith();
      vi.spyOn((store as any).sessionParser, 'parseFile').mockReturnValue(null);

      expect(store.getSessionTurns('p1', 's1')).toEqual([]);
      expect(store.getSessionTurns('p1', 'unknown')).toEqual([]);
    });

    it('finds subagent sessions too', () => {
      const store = new DashboardStore('/claude');
      (store as any).subagentSessions.set('p1', [makeSession({ id: 'sub1', turns: [], sourceFile: '/claude/projects/p1/subagents/sub1.jsonl' })]);
      vi.spyOn((store as any).sessionParser, 'parseFile').mockReturnValue(makeSession({ turns: [makeTurn({ id: 'child' })] }));

      expect(store.getSessionTurns('p1', 'sub1').map(t => t.id)).toEqual(['child']);
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/store/__tests__/DashboardStore.test.ts -t "turns on demand"`
Expected: FAIL — `store.getSessionTurns is not a function`; loaded sessions still hold turns.

- [ ] **Step 3: Implement in the store**

In `loadProject`, push the session without turns:

```ts
          parsedSessions.push({ ...session, turns: [] });
```

In `loadSubagentSessions`, replace `(session as any).parentSessionId = parentSessionId; parsed.push(session);` with:

```ts
          parsed.push({ ...session, parentSessionId, turns: [] });
```

Add the on-demand reader (module constant plus a field and a public method on the class):

```ts
const TURN_CACHE_SIZE = 3;
```

```ts
  // Full turns for recently opened sessions, keyed by file, least recent first.
  private turnCache: Map<string, Turn[]> = new Map();

  /**
   * A session's full turns, read from its JSONL on demand. Only digests stay in
   * memory; the few most recently opened sessions are kept so switching back
   * and forth doesn't re-parse a large file.
   */
  getSessionTurns(projectId: string, sessionId: string): Turn[] {
    const session = (this.sessions.get(projectId) ?? []).find(s => s.id === sessionId)
      ?? (this.subagentSessions.get(projectId) ?? []).find(s => s.id === sessionId);
    if (!session?.sourceFile) { return []; }

    const file = session.sourceFile;
    const cached = this.turnCache.get(file);
    if (cached) {
      this.turnCache.delete(file);
      this.turnCache.set(file, cached);
      return cached;
    }

    const turns = this.sessionParser.parseFile(file, projectId)?.turns ?? [];
    this.turnCache.set(file, turns);
    if (this.turnCache.size > TURN_CACHE_SIZE) {
      this.turnCache.delete(this.turnCache.keys().next().value as string);
    }
    return turns;
  }
```

First line of `onFileChanged`:

```ts
  async onFileChanged(filePath: string) {
    // The live session is appended to constantly; never serve its old turns.
    this.turnCache.delete(filePath);
```

- [ ] **Step 4: Switch every consumer of full turns to the store**

`src/webviews/ProjectPanel.ts` — the `getSessionTurns` message:

```ts
      if (msg.type === 'getSessionTurns') {
        this.panel.webview.postMessage({
          type: 'sessionTurns',
          sessionId: msg.sessionId,
          turns: store.getSessionTurns(projectId, msg.sessionId),
        });
      }
```

In `src/webviews/__tests__/ProjectPanel.test.ts`: add `getSessionTurns: ReturnType<typeof vi.fn>` to `ProjectStoreMock`; give the first test's store `getSessionTurns: vi.fn(() => [{ id: 't1' }])` and the "missing" test's store `getSessionTurns: vi.fn(() => [])`; replace the test "serves turns for subagent sessions as well as main ones" with this one (the lookup itself is now covered by the store test "finds subagent sessions too"):

```ts
  it('posts the turns the store reads for the requested session', async () => {
    let messageHandler: (msg: ProjectMessage) => Promise<void> | void = () => {};
    const store = {
      on: vi.fn(), off: vi.fn(),
      getProject: vi.fn(() => undefined),
      getSessions: vi.fn(() => []),
      getSubagentSessions: vi.fn(() => []),
      getSessionTurns: vi.fn(() => [{ id: 't9' }]),
      getProjectConfig: vi.fn(() => ({})),
      getProjectStats: vi.fn(() => ({})),
      getProjectFiles: vi.fn(() => []),
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
    };
    const panel = {
      webview: { html: '', postMessage: vi.fn(), onDidReceiveMessage: vi.fn((cb) => { messageHandler = cb; }), asWebviewUri: vi.fn((u) => u), cspSource: 'test' },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);
    const context = { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext;

    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'p1');
    await messageHandler({ type: 'getSessionTurns', sessionId: 'sub1' });

    expect(store.getSessionTurns).toHaveBeenCalledWith('p1', 'sub1');
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 'sub1', turns: [{ id: 't9' }] });
  });
```

`src/share/buildBundle.ts` — fetch each session's turns only while rendering it (import `Turn`):

```ts
export function buildBundle(
  project: Project,
  config: ProjectConfig,
  sessions: Session[],
  generatedAt: Date = new Date(),
  turnsFor: (session: Session) => Turn[] = session => session.turns
): BundleFile[] {
```

```ts
  ordered.forEach((session, i) => {
    files.push({
      relativePath: `${SESSIONS_DIR}/${entries[i].fileName}`,
      // One session's turns in memory at a time, however large the project.
      content: renderTranscript({ ...session, turns: turnsFor(session) }, project.path),
    });
  });
```

Test in `src/share/__tests__/buildBundle.test.ts`:

```ts
  it('renders each transcript from turns fetched on demand', () => {
    const files = buildBundle(project, config, [makeSession({ id: 's1', turns: [] })], new Date(0),
      () => [makeTurn({ role: 'user', content: 'Loaded on demand' })]);

    expect(files.find(f => f.relativePath.includes('/sessions/'))!.content).toContain('Loaded on demand');
  });
```

`src/share/shareContext.ts` — session scope:

```ts
  const turns = store.getSessionTurns(project.id, session.id);
  const text = redactHome(renderHandoff(project, { ...session, turns }), homeDir);
```

and project scope:

```ts
      const files = buildBundle(project, config, sessions, new Date(), s => store.getSessionTurns(project.id, s.id))
        .map(file => ({ ...file, content: redactHome(file.content, homeDir) }));
```

In `src/share/__tests__/shareContext.test.ts`, give `makeStore` a default that reads from whatever `getSessions` returns, and add a test proving turns come from the store:

```ts
function makeStore(overrides: Partial<Record<string, unknown>> = {}): DashboardStore {
  const store: Record<string, any> = {
    getProject: vi.fn(() => project),
    getSessions: vi.fn(() => [sessionA, sessionB]),
    getProjectConfig: vi.fn(() => makeProjectConfig()),
    ...overrides,
  };
  store.getSessionTurns ??= vi.fn((_projectId: string, id: string) =>
    store.getSessions().find((s: { id: string }) => s.id === id)?.turns ?? []);
  return store as unknown as DashboardStore;
}
```

```ts
  it('reads turns through the store, not from the in-memory session', async () => {
    const lean = makeSession({ id: 's5', turns: [] });
    const store = makeStore({
      getSessions: vi.fn(() => [lean]),
      getSessionTurns: vi.fn(() => [makeTurn({ role: 'user', content: 'From disk' })]),
    });

    await shareContext(store, 'p1', 'session', 's5', '/home/user');
    expect(clipboard.writeText.mock.calls[0][0]).toContain('From disk');
  });
```

`src/extension.ts` JSON export — keep today's shape:

```ts
      } else {
        // Exports carry full turns, read from disk; the digest and source path are internal.
        const full = sessions.map(({ digest: _digest, sourceFile: _sourceFile, ...s }) => ({
          ...s,
          turns: store.getSessionTurns(projectId, s.id),
        }));
        content = JSON.stringify(full, null, 2);
      }
```

In `src/__tests__/extension.test.ts` add `getSessionTurns: vi.fn(() => [{ id: 't1' }])` to `mockStore`, and at the end of the existing export test (after `exportHandler('p1', 'json')`) assert the JSON write contains it:

```ts
    const jsonBytes = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0][1] as Uint8Array;
    expect(new TextDecoder().decode(jsonBytes)).toContain('"t1"');
```

`CLAUDE.md`, State Management — replace the lazy-loading paragraph with:

```markdown
Session turns are **lazy-loaded from disk**: the store keeps each session's `digest` (user prompts, tool and MCP counts, last todos, recent tool calls) and `turns: []`. `DashboardStore.getSessionTurns()` re-reads a session's JSONL when it is opened, exported or shared, keeping the 3 most recent in memory; a file change drops that file's entry.
```

- [ ] **Step 5: Run everything to verify it passes**

Run: `npx vitest run --maxWorkers=2 && npx tsc --noEmit -p . && (cd webview-ui && npx vitest run --maxWorkers=2)`
Expected: all PASS; `grep -rn "session\.turns\|s\.turns" src/store` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/store src/webviews src/share src/extension.ts src/__tests__/extension.test.ts CLAUDE.md
git commit -m "feat(store): read session turns from disk on demand"
```

---

### Task 5: Per-file cache (v3), written asynchronously

**Files:**
- Modify: `src/store/DashboardStore.ts` — cache types, `CACHE_VERSION`, `loadProject`, `loadSubagentSessions`, new `loadSessionFile` / `readParentSessionId` / `scheduleCacheSave`; remove `saveCacheToDisk` and `getProjectMaxMtime`
- Test: `src/store/__tests__/DashboardStore.test.ts`

**Interfaces:**
- Consumes: sessions held with `turns: []` (Task 4).
- Produces: `export const CACHE_SAVE_DELAY_MS = 2_000`; cache file format v3 `{ version: 3, entries: { [projectId]: { project, files, subagentFiles } } }`, where `files` / `subagentFiles` map a JSONL file name to `{ mtimeMs, size, session }`.

- [ ] **Step 1: Write the failing tests**

(Add `import * as path from 'path';` and import `CACHE_SAVE_DELAY_MS` from the store.)

```ts
  describe('cache', () => {
    it('re-parses only the session file that changed', async () => {
      const store = new DashboardStore('/claude');
      const mtimes: Record<string, number> = { 'a.jsonl': 1, 'b.jsonl': 1 };
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readdirSync).mockImplementation(() => Object.keys(mtimes) as unknown as ReturnType<typeof fs.readdirSync>);
      vi.mocked(fs.statSync).mockImplementation(p => ({ mtimeMs: mtimes[path.basename(String(p))], size: 10 }) as fs.Stats);
      const parseFile = vi.spyOn((store as any).sessionParser, 'parseFile')
        .mockImplementation((file: unknown) => makeSession({ id: path.basename(String(file), '.jsonl') }));
      const live = { ids: new Set<string>(), available: true };

      await (store as any).loadProject('p1', '/claude/projects/p1', live);
      mtimes['b.jsonl'] = 2;
      await (store as any).loadProject('p1', '/claude/projects/p1', live);

      expect(parseFile).toHaveBeenCalledTimes(3);
      expect(parseFile).toHaveBeenLastCalledWith('/claude/projects/p1/b.jsonl', 'p1');
      expect(store.getSessions('p1').map(s => s.id).sort()).toEqual(['a', 'b']);
    });

    it('does not double-count subagent cost when a cached session is reused', async () => {
      const store = new DashboardStore('/claude');
      vi.mocked(fs.existsSync).mockImplementation(p => String(p).endsWith('/subagents'));
      vi.mocked(fs.readdirSync).mockImplementation(p =>
        (String(p).endsWith('/subagents') ? ['child.jsonl'] : ['main.jsonl']) as unknown as ReturnType<typeof fs.readdirSync>);
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1, size: 10 } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('' as ReturnType<typeof fs.readFileSync>);
      vi.spyOn((store as any).sessionParser, 'parseFile').mockImplementation((file: unknown) =>
        String(file).endsWith('child.jsonl') ? makeSession({ id: 'child', costUsd: 0.3 }) : makeSession({ id: 'main', costUsd: 1 }));
      const live = { ids: new Set<string>(), available: true };

      await (store as any).loadProject('p1', '/claude/projects/p1', live);
      await (store as any).loadProject('p1', '/claude/projects/p1', live);

      expect(store.getSessions('p1')[0].subagentCostUsd).toBe(0.3);
    });

    it('ignores a cache written by an older version', () => {
      const store = new DashboardStore('/claude', '/cache');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: 2, entries: { p1: {} } }) as ReturnType<typeof fs.readFileSync>);

      (store as any).loadCacheFromDisk();
      expect((store as any).cacheData).toEqual({ version: 3, entries: {} });
    });

    it('survives a corrupt cache file', () => {
      const store = new DashboardStore('/claude', '/cache');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{half-written' as ReturnType<typeof fs.readFileSync>);

      expect(() => (store as any).loadCacheFromDisk()).not.toThrow();
      expect((store as any).cacheData).toEqual({ version: 3, entries: {} });
    });

    it('writes the cache once per burst of changes, atomically and without turns', async () => {
      const store = new DashboardStore('/claude', '/cache');
      (store as any).cacheData.entries.p1 = {
        project: makeProject(),
        files: { 's.jsonl': { mtimeMs: 1, size: 1, session: makeSession({ turns: [] }) } },
        subagentFiles: {},
      };
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      (store as any).scheduleCacheSave();
      (store as any).scheduleCacheSave();
      await vi.advanceTimersByTimeAsync(CACHE_SAVE_DELAY_MS);

      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      const [tmpPath, body] = vi.mocked(fs.promises.writeFile).mock.calls[0];
      expect(String(tmpPath)).toMatch(/^\/cache\/project-cache\.json\.\d+\.tmp$/);
      expect(fs.promises.rename).toHaveBeenCalledWith(tmpPath, '/cache/project-cache.json');
      expect(String(body)).not.toMatch(/"turns":\[\{/);
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/store/__tests__/DashboardStore.test.ts -t "cache"`
Expected: FAIL — every file re-parsed (4 calls, not 3); cache version still 2; `scheduleCacheSave` is not a function.

- [ ] **Step 3: Implement**

Replace the cache types and version:

```ts
const CACHE_VERSION = 3;
export const CACHE_SAVE_DELAY_MS = 2_000;

interface CachedFile {
  mtimeMs: number;
  size: number;
  session: Session;   // held without turns
}

interface CacheEntry {
  project: Project;
  files: Record<string, CachedFile>;          // session JSONL name → parsed session
  subagentFiles: Record<string, CachedFile>;  // subagents/*.jsonl name → parsed session
}
```

Add the per-file loader and the parent lookup (the parent scan moves here verbatim from `loadSubagentSessions`):

```ts
  /**
   * One session file, reused from the cache while its mtime and size match and
   * parsed otherwise — so a change re-parses that file alone. Held without turns.
   */
  private loadSessionFile(
    dir: string,
    file: string,
    projectId: string,
    previous: Record<string, CachedFile> | undefined,
    into: Record<string, CachedFile>,
    annotate: (filePath: string, session: Session) => Session = (_filePath, session) => session,
  ): Session | null {
    const filePath = path.join(dir, file);
    let stat: fs.Stats;
    try { stat = fs.statSync(filePath); } catch { return null; }

    const hit = previous?.[file];
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
      into[file] = hit;
      return hit.session;
    }

    const parsed = this.sessionParser.parseFile(filePath, projectId);
    if (!parsed) { return null; }
    const session = annotate(filePath, { ...parsed, turns: [] });
    into[file] = { mtimeMs: stat.mtimeMs, size: stat.size, session };
    return session;
  }

  /** The first parent-session reference in a subagent log, if any. */
  private readParentSessionId(filePath: string): string | null {
    try {
      for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
        if (!line.trim()) { continue; }
        try {
          const entry = JSON.parse(line);
          const pid = entry.parentSessionId ?? entry.parent_session_id ?? entry.parentId ?? null;
          if (pid) { return String(pid); }
        } catch { continue; }
      }
    } catch { /* unreadable: no parent */ }
    return null;
  }
```

`loadSubagentSessions` takes the previous and next file maps:

```ts
  private loadSubagentSessions(
    projectDir: string,
    encodedId: string,
    previous: Record<string, CachedFile> | undefined,
    into: Record<string, CachedFile>,
  ): Map<string, number> {
    const costs = new Map<string, number>();
    const parsed: Session[] = [];
    const subagentsDir = path.join(projectDir, 'subagents');
    if (!fs.existsSync(subagentsDir)) {
      this.subagentSessions.set(encodedId, []);
      return costs;
    }
    try {
      for (const file of fs.readdirSync(subagentsDir).filter(f => f.endsWith('.jsonl'))) {
        const session = this.loadSessionFile(subagentsDir, file, encodedId, previous, into,
          (filePath, s) => ({ ...s, parentSessionId: this.readParentSessionId(filePath) }));
        if (!session) { continue; }
        parsed.push(session);
        const key = session.parentSessionId ?? '__unknown__';
        costs.set(key, (costs.get(key) ?? 0) + session.costUsd);
      }
    } catch { /* ignore */ }
    this.subagentSessions.set(encodedId, parsed);
    return costs;
  }
```

In `loadProject`, delete the "Cache check" block (the `getProjectMaxMtime` / `cachedAt` shortcut), replace the `loadSubagentSessions` call and the parse loop:

```ts
      const previous = this.cacheData.entries[encodedId];
      const files: Record<string, CachedFile> = {};
      const subagentFiles: Record<string, CachedFile> = {};
      const subagentCosts = this.loadSubagentSessions(projectDir, encodedId, previous?.subagentFiles, subagentFiles);
```

```ts
      for (const file of sessionFiles) {
        const loaded = this.loadSessionFile(projectDir, file, encodedId, previous?.files, files);
        if (!loaded) { continue; }
        // A fresh copy per load: subagent costs are attributed onto it below,
        // and the cached original must not accumulate them across reloads.
        const session: Session = {
          ...loaded,
          subagentCostUsd: 0,
          isActiveSession: liveResult.available ? liveResult.ids.has(loaded.id) : loaded.isActiveSession,
        };
        if (!resolvedCwd && session.cwd) { resolvedCwd = session.cwd; }
        parsedSessions.push(session);
        totalTokens += session.totalTokens;
        totalCostUsd += session.costUsd;
        sessionCount++;
        const sessionLatest = session.endTime ?? session.digest.lastTurnAt ?? session.startTime;
        if (sessionLatest > lastActive) { lastActive = sessionLatest; }
      }
```

and its cache write:

```ts
      this.cacheData.entries[encodedId] = { project, files, subagentFiles };
```

Replace `saveCacheToDisk` with a debounced, atomic, asynchronous save; call `this.scheduleCacheSave()` where `scanProjects` and `onFileChanged` called `this.saveCacheToDisk()`; delete `getProjectMaxMtime`:

```ts
  private cacheSaveTimer?: NodeJS.Timeout;

  /**
   * Saves the cache once a burst of changes settles, off the extension host's
   * critical path. Writing a per-process temp file and renaming it means another
   * window never reads a half-written cache.
   */
  private scheduleCacheSave() {
    const cachePath = this.getCachePath();
    if (!cachePath) { return; }
    if (this.cacheSaveTimer) { clearTimeout(this.cacheSaveTimer); }
    this.cacheSaveTimer = setTimeout(async () => {
      const tmpPath = `${cachePath}.${process.pid}.tmp`;
      try {
        await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.promises.writeFile(tmpPath, JSON.stringify(this.cacheData));
        await fs.promises.rename(tmpPath, cachePath);
      } catch { /* the cache is an optimisation; a failed save costs one re-parse */ }
    }, CACHE_SAVE_DELAY_MS);
  }
```

- [ ] **Step 4: Update the existing cache test to the v3 format**

In "loads projects from disk, uses cache, and handles pid/subagent helpers":

Replace `expect(fs.mkdirSync).toHaveBeenCalledWith('/cache', { recursive: true }); expect(fs.writeFileSync).toHaveBeenCalled();` with:

```ts
    await vi.advanceTimersByTimeAsync(CACHE_SAVE_DELAY_MS);
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/cache', { recursive: true });
    expect(fs.promises.writeFile).toHaveBeenCalled();
```

Replace the seeded `version: 2` cache with the v3 shape, using the mtimes its `statSync` mock returns (`session.jsonl` → `NOW - 2000`, everything else → `NOW`; the mock returns no `size`, so none is stored):

```ts
        return JSON.stringify({
          version: 3,
          entries: {
            demo: {
              project: makeProject({ id: 'demo', name: 'demo', path: '/workspace/demo', isActive: false }),
              files: { 'session.jsonl': { mtimeMs: NOW - 2000, session: makeSession({ id: 'cached-session', projectId: 'demo', isActiveSession: false, turns: [] }) } },
              subagentFiles: { 'child.jsonl': { mtimeMs: NOW, session: makeSession({ id: 'cached-child', projectId: 'demo', turns: [] }) } },
            },
          },
        }) as ReturnType<typeof fs.readFileSync>;
```

The assertions after `await store.refresh()` (`parseFile` not called, first session `cached-session`) stay as they are; if one counts subagent sessions after the refresh, it now expects the one cached child.

- [ ] **Step 5: Run everything to verify it passes**

Run: `npx vitest run --maxWorkers=2 && npx tsc --noEmit -p . && (cd webview-ui && npx vitest run --maxWorkers=2) && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 6: Measure on real data**

Bundle and run a script in the scratchpad (not the repo) that constructs `new DashboardStore(path.join(os.homedir(), '.claude'), <temp dir>)`, awaits `initialize()`, then prints `process.memoryUsage().heapUsed`, the cache file size after `CACHE_SAVE_DELAY_MS`, and the time `onFileChanged(<one JSONL in the largest project>)` takes. Expected against the 2026-10-09 baseline: heap well below ~600 MB; cache a few MB instead of 51.5 MB; a file change costs that file's parse only (not ~780 ms for the whole project); `getSessionTurns` for this repository's live session returns its turns.

- [ ] **Step 7: Commit**

```bash
git add src/store/DashboardStore.ts src/store/__tests__/DashboardStore.test.ts
git commit -m "perf(store): cache sessions per file and save the cache asynchronously"
```
