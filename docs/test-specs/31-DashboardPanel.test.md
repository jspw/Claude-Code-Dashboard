# Spec 31: DashboardPanel Unit Tests

## Test File Path
`src/webviews/__tests__/DashboardPanel.test.ts`

## Source Under Test
`src/webviews/DashboardPanel.ts`

## Setup

### Imports
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { DashboardPanel } from '../DashboardPanel';
import { createMockExtensionContext } from '../../__tests__/__mocks__/vscode';
```

### Mocks

#### Mock getWebviewContent
```typescript
vi.mock('../getWebviewContent', () => ({
  getWebviewContent: vi.fn(() => '<html>mock</html>'),
}));
```

#### Mock Store Factory
Create a mock store that implements all query methods used by `DashboardPanel.buildState`:
```typescript
function createMockStore() {
  const listeners: Record<string, Function[]> = {};
  return {
    getProjects: vi.fn(() => []),
    getStats: vi.fn(() => ({
      totalProjects: 0, activeSessionCount: 0,
      tokensTodayTotal: 0, costTodayUsd: 0,
      tokensWeekTotal: 0, costWeekUsd: 0,
    })),
    getUsageOverTime: vi.fn(() => []),
    getUsageByProject: vi.fn(() => []),
    getHeatmapData: vi.fn(() => []),
    getPromptPatterns: vi.fn(() => []),
    getAllPrompts: vi.fn(() => []),
    getToolUsageStats: vi.fn(() => []),
    getHotFiles: vi.fn(() => []),
    getProjectedCost: vi.fn(() => ({
      dailyAvgCost: 0, projectedMonthCost: 0,
      currentMonthCost: 0, daysElapsed: 0, daysRemaining: 0,
    })),
    getStreak: vi.fn(() => ({ currentStreak: 0, longestStreak: 0, totalActiveDays: 0 })),
    getEfficiencyStats: vi.fn(() => ({
      avgTokensPerPrompt: 0, avgToolCallsPerSession: 0,
      avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0,
    })),
    getWeeklyRecap: vi.fn(() => ({
      sessions: 0, projects: 0, tokens: 0, costUsd: 0,
      filesModified: 0, topProject: '', topProjectTokens: 0,
      longestSessionMin: 0, mostUsedTool: '',
    })),
    getRecentFileChanges: vi.fn(() => []),
    getProductivityByHour: vi.fn(() => []),
    getMonthlyUsage: vi.fn(() => ({ costUsd: 0 })),
    on: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) { listeners[event] = []; }
      listeners[event].push(cb);
    }),
    // Helper to emit events in tests
    _emit: (event: string, ...args: any[]) => {
      (listeners[event] || []).forEach(cb => cb(...args));
    },
  };
}
```

#### Mock Webview Panel
The vscode mock's `window.createWebviewPanel` already returns a mock panel. However, to capture `onDidReceiveMessage` and `onDidDispose` callbacks, enhance the mock:

```typescript
let onReceiveMessageCallback: Function;
let onDisposeCallback: Function;
let mockPanel: any;

beforeEach(() => {
  // Reset the static currentPanel
  (DashboardPanel as any).currentPanel = undefined;

  mockPanel = {
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: vi.fn((cb: Function) => { onReceiveMessageCallback = cb; }),
      postMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: any) => uri),
      cspSource: 'test-csp',
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn((cb: Function) => { onDisposeCallback = cb; }),
    dispose: vi.fn(),
  };

  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel);
});
```

---

## Test Cases

### Test 1: createOrShow creates panel on first call

**Description**: On the first call, `createOrShow` should call `vscode.window.createWebviewPanel` to create a new webview panel.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.

**Assertions**:
- `vscode.window.createWebviewPanel` called once.
- Called with `'claudeDashboard'` as the first argument (viewType).
- Called with `'Claude Code Dashboard'` as the second argument (title).

---

### Test 2: createOrShow reveals existing panel on second call

**Description**: If a panel already exists, calling `createOrShow` again should reveal the existing panel instead of creating a new one.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)` (creates panel).
2. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)` again.

**Assertions**:
- `vscode.window.createWebviewPanel` called only once (not twice).
- `mockPanel.reveal` called once (on the second invocation).

---

### Test 3: sets webview HTML with dashboard view

**Description**: After creation, the panel's `webview.html` is set via `getWebviewContent` with `'dashboard'` as the view.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.

**Assertions**:
- `mockPanel.webview.html` is `'<html>mock</html>'` (the mocked return value).
- The mocked `getWebviewContent` was called with the webview, extensionUri, `'dashboard'`, and an object (the state).

---

### Test 4: sends stateUpdate on store 'updated' event

**Description**: When the store emits an `'updated'` event, the panel posts a `stateUpdate` message to the webview.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.
2. Emit `'updated'` on the store: `mockStore._emit('updated')`.

**Assertions**:
- `mockPanel.webview.postMessage` called with an object matching `{ type: 'stateUpdate', payload: expect.any(Object) }`.

---

### Test 5: sends liveEvent on store 'liveEvent' event

**Description**: When the store emits a `'liveEvent'` event, the panel forwards it to the webview.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.
2. Emit `'liveEvent'` on the store with a sample event: `mockStore._emit('liveEvent', { type: 'tool_use', tool: 'Read', timestamp: 123 })`.

**Assertions**:
- `mockPanel.webview.postMessage` called with `{ type: 'liveEvent', payload: { type: 'tool_use', tool: 'Read', timestamp: 123 } }`.

---

### Test 6: handles openProject message

**Description**: When the webview sends an `openProject` message, the panel executes the `claudeDashboard.openProject` command.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.
2. Simulate the webview sending a message: `onReceiveMessageCallback({ type: 'openProject', projectId: 'proj-123' })`.

**Assertions**:
- `vscode.commands.executeCommand` called with `'claudeDashboard.openProject'` and `'proj-123'`.

---

### Test 7: cleans up on dispose

**Description**: When the panel is disposed, `DashboardPanel.currentPanel` is set to `undefined`.

**Steps**:
1. Call `DashboardPanel.createOrShow(mockContext, mockStore as any)`.
2. Verify `DashboardPanel.currentPanel` is defined.
3. Call the dispose callback: `onDisposeCallback()`.

**Assertions**:
- `DashboardPanel.currentPanel` is `undefined` after dispose.

---

## Validation Criteria
- All 7 tests pass with `npx vitest run src/webviews/__tests__/DashboardPanel.test.ts`.
- The vscode mock is provided by the global setup.
- `getWebviewContent` is mocked at the module level.
- The static `currentPanel` is reset before each test.
