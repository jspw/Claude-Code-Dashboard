# Spec 24: FileWatcher Tests

## Test File
**Path**: `src/watchers/__tests__/FileWatcher.test.ts`

## Source Under Test
**Path**: `src/watchers/FileWatcher.ts`

## Important: This is in the extension root (NOT webview-ui)
Uses root `vitest.config.ts` (Node environment). The vscode mock is auto-loaded from `src/__tests__/setup.ts`.

## Imports

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcher } from '../FileWatcher';
```

## Mock Setup

### Mock `fs` module

```ts
vi.mock('fs', () => {
  const watchers: any[] = [];
  return {
    existsSync: vi.fn(() => true),
    watch: vi.fn((_path: string, _opts: any, callback: Function) => {
      const watcher = {
        _callback: callback,
        on: vi.fn(),
        close: vi.fn(),
      };
      watchers.push(watcher);
      return watcher;
    }),
    // Expose watchers for test access
    __getWatchers: () => watchers,
    __clearWatchers: () => { watchers.length = 0; },
  };
});
```

Import fs for access to mock functions:

```ts
import * as fs from 'fs';
```

### Mock DashboardStore

```ts
function createMockStore() {
  return {
    onFileChanged: vi.fn(),
    on: vi.fn(),
    getStats: vi.fn(),
    getProjects: vi.fn(),
  };
}
```

### Mock ExtensionContext

```ts
function createMockContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
  };
}
```

### Timer control

Use Vitest fake timers to control debounce behavior:

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  (fs as any).__clearWatchers?.();
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Test Cases

### Test 1: does nothing if projects dir doesn't exist
**Description**: If `fs.existsSync` returns `false` for the projects directory, the watcher should not be created.

```ts
it('does nothing if projects dir does not exist', () => {
  (fs.existsSync as any).mockReturnValueOnce(false);
  const store = createMockStore();
  const context = createMockContext();
  const watcher = new FileWatcher('/home/user/.claude', store as any);
  watcher.start(context as any);

  expect(fs.watch).not.toHaveBeenCalled();
  expect(context.subscriptions).toHaveLength(0);
});
```

**Assertions**:
- `fs.watch` is never called.
- No disposable is added to `context.subscriptions`.

### Test 2: starts watching projects dir
**Description**: When the projects directory exists, `fs.watch` should be called with the projects path and `{ recursive: true }`.

```ts
it('starts watching projects dir', () => {
  const store = createMockStore();
  const context = createMockContext();
  const watcher = new FileWatcher('/home/user/.claude', store as any);
  watcher.start(context as any);

  expect(fs.existsSync).toHaveBeenCalledWith('/home/user/.claude/projects');
  expect(fs.watch).toHaveBeenCalledWith(
    '/home/user/.claude/projects',
    { recursive: true },
    expect.any(Function)
  );
  // Should register a disposable
  expect(context.subscriptions).toHaveLength(1);
});
```

**Assertions**:
- `fs.existsSync` is called with the projects path.
- `fs.watch` is called with the correct path and `recursive: true`.
- One disposable is pushed to `context.subscriptions`.

### Test 3: ignores non-jsonl files
**Description**: When the watcher callback fires with a filename that does not end in `.jsonl`, no action should be taken.

```ts
it('ignores non-jsonl files', () => {
  const store = createMockStore();
  const context = createMockContext();
  const watcher = new FileWatcher('/home/user/.claude', store as any);
  watcher.start(context as any);

  // Get the watcher callback
  const watchCallback = (fs.watch as any).mock.calls[0][2];

  // Trigger with non-jsonl file
  watchCallback('change', 'some-file.txt');
  vi.advanceTimersByTime(500);

  expect(store.onFileChanged).not.toHaveBeenCalled();

  // Trigger with null filename
  watchCallback('change', null);
  vi.advanceTimersByTime(500);

  expect(store.onFileChanged).not.toHaveBeenCalled();
});
```

**Assertions**:
- `store.onFileChanged` is never called for non-`.jsonl` files or null filenames.

### Test 4: debounces rapid changes (300ms)
**Description**: Multiple rapid changes to the same file should result in only one call to `store.onFileChanged` after the 300ms debounce period.

```ts
it('debounces rapid changes (300ms)', () => {
  const store = createMockStore();
  const context = createMockContext();
  const fw = new FileWatcher('/home/user/.claude', store as any);
  fw.start(context as any);

  const watchCallback = (fs.watch as any).mock.calls[0][2];

  // Rapid fire 5 changes to the same file
  watchCallback('change', 'project-hash/session.jsonl');
  watchCallback('change', 'project-hash/session.jsonl');
  watchCallback('change', 'project-hash/session.jsonl');
  watchCallback('change', 'project-hash/session.jsonl');
  watchCallback('change', 'project-hash/session.jsonl');

  // Before debounce expires
  vi.advanceTimersByTime(200);
  expect(store.onFileChanged).not.toHaveBeenCalled();

  // After debounce expires (300ms from last call)
  vi.advanceTimersByTime(200); // total 400ms from last change
  expect(store.onFileChanged).toHaveBeenCalledTimes(1);
});
```

**Assertions**:
- After 200ms, `onFileChanged` has not been called.
- After the full debounce period, `onFileChanged` is called exactly once.

### Test 5: calls store.onFileChanged after debounce
**Description**: After the debounce, `store.onFileChanged` should be called with the full file path.

```ts
it('calls store.onFileChanged after debounce with correct path', () => {
  const store = createMockStore();
  const context = createMockContext();
  const fw = new FileWatcher('/home/user/.claude', store as any);
  fw.start(context as any);

  const watchCallback = (fs.watch as any).mock.calls[0][2];
  watchCallback('change', 'my-project/session-abc.jsonl');

  vi.advanceTimersByTime(300);

  expect(store.onFileChanged).toHaveBeenCalledWith(
    '/home/user/.claude/projects/my-project/session-abc.jsonl'
  );
});
```

**Assertions**:
- `store.onFileChanged` is called with the full path: `<claudeDir>/projects/<filename>`.

### Test 6: registers disposable on context
**Description**: The watcher should push a disposable to `context.subscriptions` that closes the watcher and clears timers when disposed.

```ts
it('registers disposable on context', () => {
  const store = createMockStore();
  const context = createMockContext();
  const fw = new FileWatcher('/home/user/.claude', store as any);
  fw.start(context as any);

  expect(context.subscriptions).toHaveLength(1);

  // Get the mock watcher to check close() is called
  const mockWatcher = (fs.watch as any).mock.results[0].value;

  // Call dispose
  context.subscriptions[0].dispose();
  expect(mockWatcher.close).toHaveBeenCalled();
});
```

**Assertions**:
- One disposable is pushed to `context.subscriptions`.
- Calling `dispose()` on it calls `watcher.close()`.

## Validation Criteria
- All 6 tests pass with `npx vitest run src/watchers/__tests__/FileWatcher.test.ts` from the project root (`claude-dashboard/`).
- Fake timers are used to control and test the 300ms debounce behavior.
- The `fs` mock captures the watch callback for direct invocation in tests.
- All file paths use `path.join` internally in the source, so assertions use forward-slash paths (adjust if running on Windows, but macOS is the target platform).
