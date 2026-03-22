# Spec 22: StatusBarProvider Tests

## Test File
**Path**: `src/providers/__tests__/StatusBarProvider.test.ts`

## Source Under Test
**Path**: `src/providers/StatusBarProvider.ts`

## Important: This is in the extension root (NOT webview-ui)
This test uses the root `vitest.config.ts` (Node environment, not jsdom). The vscode mock is at `src/__tests__/__mocks__/vscode.ts` and is auto-loaded by `src/__tests__/setup.ts`.

## Imports

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBarProvider } from '../StatusBarProvider';
import * as vscode from 'vscode';
```

## Mock Setup

The `src/__tests__/setup.ts` file already calls `vi.mock('vscode', ...)` which provides mocked `window.createStatusBarItem`. However, we need a mock DashboardStore.

### Mock DashboardStore

Create an inline mock that simulates EventEmitter behavior:

```ts
function createMockStore(stats = defaultStats) {
  const listeners: Record<string, Function[]> = {};
  return {
    getStats: vi.fn(() => stats),
    on: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    emit(event: string) {
      (listeners[event] ?? []).forEach(cb => cb());
    },
    getProjects: vi.fn(() => []),
  };
}
```

### Default stats data

```ts
const defaultStats = {
  totalProjects: 3,
  activeSessionCount: 0,
  tokensTodayTotal: 5000,
  costTodayUsd: 0.25,
  tokensWeekTotal: 30000,
  costWeekUsd: 1.5,
};
```

### beforeEach

```ts
let mockItem: any;

beforeEach(() => {
  vi.clearAllMocks();
  // Get a fresh reference to the mock status bar item
  // vscode.window.createStatusBarItem returns a mock object
  mockItem = (vscode.window.createStatusBarItem as any)();
  // Reset the mock so our provider's call is the first
  (vscode.window.createStatusBarItem as any).mockClear();
  // Make createStatusBarItem return the same mockItem
  (vscode.window.createStatusBarItem as any).mockReturnValue(mockItem);
});
```

## Test Cases

### Test 1: creates status bar item on right side
**Description**: The constructor should call `vscode.window.createStatusBarItem` with `StatusBarAlignment.Right` and priority `100`.

```ts
it('creates status bar item on right side', () => {
  const store = createMockStore();
  new StatusBarProvider(store as any);
  expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
    vscode.StatusBarAlignment.Right,
    100
  );
});
```

**Assertions**:
- `createStatusBarItem` is called with `Right` alignment and priority `100`.

### Test 2: sets command to openDashboard
**Description**: The status bar item's `command` property should be set to `'claudeDashboard.openDashboard'`.

```ts
it('sets command to openDashboard', () => {
  const store = createMockStore();
  new StatusBarProvider(store as any);
  expect(mockItem.command).toBe('claudeDashboard.openDashboard');
});
```

**Assertions**:
- `item.command` equals `'claudeDashboard.openDashboard'`.

### Test 3: shows active count when > 0
**Description**: When `activeSessionCount > 0`, the text should include the active count.

```ts
it('shows active count when > 0', () => {
  const stats = { ...defaultStats, activeSessionCount: 3 };
  const store = createMockStore(stats);
  new StatusBarProvider(store as any);
  expect(mockItem.text).toContain('3 active');
});
```

**Assertions**:
- The status bar text contains "3 active".

### Test 4: shows tokens and cost
**Description**: The text should include formatted tokens and cost. With 5000 tokens, `formatTokens` returns "5.0k". Cost of 0.25 formatted as "$0.25".

```ts
it('shows tokens and cost', () => {
  const store = createMockStore();
  new StatusBarProvider(store as any);
  expect(mockItem.text).toContain('5.0k');
  expect(mockItem.text).toContain('$0.25');
});
```

**Assertions**:
- Status bar text contains "5.0k" and "$0.25".

### Test 5: updates on store 'updated' event
**Description**: When the store emits an 'updated' event, the status bar text should refresh with new data.

```ts
it('updates on store updated event', () => {
  const stats = { ...defaultStats };
  const store = createMockStore(stats);
  new StatusBarProvider(store as any);

  // Change what getStats returns
  const newStats = { ...defaultStats, tokensTodayTotal: 100000, costTodayUsd: 5.0, activeSessionCount: 1 };
  store.getStats.mockReturnValue(newStats);

  // Trigger the update
  store.emit('updated');

  expect(mockItem.text).toContain('100.0k');
  expect(mockItem.text).toContain('$5.00');
  expect(mockItem.text).toContain('1 active');
});
```

**Assertions**:
- After emitting 'updated', the status bar text reflects the new stats.

### Test 6: disposes item correctly
**Description**: Calling `dispose()` on the provider should call `dispose()` on the underlying status bar item.

```ts
it('disposes item correctly', () => {
  const store = createMockStore();
  const provider = new StatusBarProvider(store as any);
  provider.dispose();
  expect(mockItem.dispose).toHaveBeenCalled();
});
```

**Assertions**:
- `item.dispose()` is called when the provider is disposed.

## Validation Criteria
- All 6 tests pass with `npx vitest run src/providers/__tests__/StatusBarProvider.test.ts` from the project root (`claude-dashboard/`).
- The vscode mock from `src/__tests__/__mocks__/vscode.ts` provides `window.createStatusBarItem` and `StatusBarAlignment`.
- The DashboardStore mock uses a simple listener pattern to simulate EventEmitter's `on` and `emit`.
