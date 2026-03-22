# Spec 25: EventWatcher Unit Tests

## Test File Path
`src/watchers/__tests__/EventWatcher.test.ts`

## Source Under Test
`src/watchers/EventWatcher.ts`

## Setup

### Imports
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventWatcher } from '../EventWatcher';
import * as fs from 'fs';
```

### Mocks
```typescript
vi.mock('fs');
```

The `vscode` mock is already registered globally via `src/__tests__/setup.ts` which calls `vi.mock('vscode', () => import('./__mocks__/vscode'))`.

### Mock Store Factory
Create a mock store that mimics the `DashboardStore` interface used by `EventWatcher`:
```typescript
function createMockStore() {
  return {
    handleLiveEvent: vi.fn(),
  };
}
```

### Mock Extension Context Factory
```typescript
function createMockContext() {
  return {
    subscriptions: [] as { dispose: () => void }[],
  };
}
```

### Constants
```typescript
const CLAUDE_DIR = '/test/.claude';
const EVENTS_FILE = '/test/.claude/.dashboard-events.jsonl';
```

### beforeEach
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
```

### afterEach
```typescript
afterEach(() => {
  vi.useRealTimers();
});
```

---

## Test Cases

### Test 1: starts polling with setInterval at 500ms

**Description**: When `start()` is called, it should set up a recurring interval that calls `checkForNewEvents` every 500ms.

**Steps**:
1. Create `EventWatcher` with mock store.
2. Mock `fs.existsSync` to return `false` (so rotateEventsFile and checkForNewEvents are no-ops).
3. Call `watcher.start(mockContext)`.
4. Verify that one disposable is pushed to `context.subscriptions`.
5. Advance timers by 500ms, verify `fs.existsSync` was called (for checkForNewEvents).
6. Advance timers by another 500ms, verify `fs.existsSync` call count incremented.

**Assertions**:
- `mockContext.subscriptions.length` toBe `1`
- `fs.existsSync` called with `EVENTS_FILE` after each 500ms tick

---

### Test 2: rotates file if larger than 5MB

**Description**: On `start()`, the watcher calls `rotateEventsFile()` which checks if the events file exceeds 5MB. If it does, it reads the file, keeps the last 1000 lines, and writes them back.

**Steps**:
1. Mock `fs.existsSync` to return `true`.
2. Mock `fs.statSync` to return `{ size: 6 * 1024 * 1024 }` (6MB, over threshold).
3. Create a string with 2000 lines: `Array.from({ length: 2000 }, (_, i) => JSON.stringify({ type: 'tool_use', timestamp: i })).join('\n')`.
4. Mock `fs.readFileSync` to return that string.
5. Mock `fs.writeFileSync`.
6. Call `watcher.start(mockContext)`.

**Assertions**:
- `fs.writeFileSync` called once with `EVENTS_FILE` as first arg.
- The written content (second arg) should contain exactly 1000 lines (split by `\n`, filter empty, length === 1000).
- The written content should end with `\n`.

---

### Test 3: keeps last 1000 lines on rotation

**Description**: When rotation occurs, only the last 1000 lines of the file are preserved.

**Steps**:
1. Same setup as Test 2 but with 1500 lines.
2. Each line is `JSON.stringify({ type: 'tool_use', timestamp: i })` where i is the index.
3. After `start()`, inspect the content passed to `fs.writeFileSync`.

**Assertions**:
- Parse each line of the written content. The first line should have `timestamp: 500` (line index 500, i.e., the 501st original line).
- The last line should have `timestamp: 1499`.
- Total lines count === 1000.

---

### Test 4: reads only new bytes since last check

**Description**: `checkForNewEvents` reads only the bytes that were appended since the last check (from `lastSize` to current `stat.size`).

**Steps**:
1. Mock `fs.existsSync` to return `false` initially for `rotateEventsFile`, then `true` for subsequent calls.
2. Create the watcher and start it.
3. Set up mocks for checkForNewEvents:
   - `fs.existsSync` returns `true`.
   - `fs.statSync` returns `{ size: 100 }`.
   - `fs.openSync` returns `42` (fake fd).
   - `fs.readSync` fills buffer with a JSON line.
   - `fs.closeSync` is a no-op.
4. Advance timer by 500ms to trigger first check.
5. Then update `fs.statSync` to return `{ size: 200 }`.
6. Advance timer by another 500ms.

**Assertions**:
- On first read, `fs.readSync` called with offset `0` and length `100`.
- On second read, `fs.readSync` called with offset `100` and length `100`.

---

### Test 5: parses events and calls store.handleLiveEvent

**Description**: Valid JSONL lines in new bytes are parsed and each event is passed to `store.handleLiveEvent`.

**Steps**:
1. Mock `fs.existsSync` to return `false` for rotation check, `true` for poll check.
2. Create watcher with mock store and start it.
3. Create two valid event lines:
   ```
   {"type":"tool_use","tool":"Read","timestamp":1000}
   {"type":"session_stop","sessionId":"abc","timestamp":2000}
   ```
4. Mock `fs.statSync` to return `{ size: <byte length of both lines> }`.
5. Mock `fs.openSync` to return fd `1`.
6. Mock `fs.readSync` to copy the event lines bytes into the buffer.
7. Advance timer by 500ms.

**Implementation detail for readSync mock**:
```typescript
vi.mocked(fs.readSync).mockImplementation((_fd, buffer: Buffer) => {
  const data = Buffer.from(eventLines, 'utf-8');
  data.copy(buffer);
  return data.length;
});
```

**Assertions**:
- `store.handleLiveEvent` called exactly 2 times.
- First call arg: `{ type: 'tool_use', tool: 'Read', timestamp: 1000 }`.
- Second call arg: `{ type: 'session_stop', sessionId: 'abc', timestamp: 2000 }`.

---

### Test 6: skips malformed event lines

**Description**: Lines that are not valid JSON are silently skipped without throwing.

**Steps**:
1. Same setup as Test 5 but include a malformed line between two valid lines:
   ```
   {"type":"tool_use","timestamp":1}
   NOT VALID JSON {{{
   {"type":"session_stop","timestamp":2}
   ```
2. Advance timer by 500ms.

**Assertions**:
- `store.handleLiveEvent` called exactly 2 times (malformed line skipped).
- No errors thrown.

---

### Test 7: registers disposable for cleanup

**Description**: The disposable pushed to `context.subscriptions` clears the interval when disposed.

**Steps**:
1. Mock `fs.existsSync` to return `false` (no rotation, no events).
2. Create watcher and start it.
3. Get the disposable from `mockContext.subscriptions[0]`.
4. Call `disposable.dispose()`.
5. Clear the `fs.existsSync` mock call count.
6. Advance timer by 1000ms.

**Assertions**:
- After disposing, `fs.existsSync` should NOT have been called again (interval was cleared).
- `mockContext.subscriptions` has length 1 (it was registered).

---

## Validation Criteria
- All 7 tests pass with `npx vitest run src/watchers/__tests__/EventWatcher.test.ts`.
- No real filesystem access occurs (all fs methods are mocked).
- Fake timers are used; no real delays.
