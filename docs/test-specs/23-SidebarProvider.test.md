# Spec 23: SidebarProvider Tests

## Test File
**Path**: `src/providers/__tests__/SidebarProvider.test.ts`

## Source Under Test
**Path**: `src/providers/SidebarProvider.ts`

## Important: This is in the extension root (NOT webview-ui)
Uses root `vitest.config.ts` (Node environment). The vscode mock is auto-loaded from `src/__tests__/setup.ts`.

## Imports

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarProvider } from '../SidebarProvider';
import * as vscode from 'vscode';
import { createMockExtensionContext } from '../../__tests__/__mocks__/vscode';
```

## Mock Setup

### Mock getWebviewContent

The `SidebarProvider` imports `getWebviewContent` to generate HTML. Mock it:

```ts
vi.mock('../../webviews/getWebviewContent', () => ({
  getWebviewContent: vi.fn(() => '<html>mock</html>'),
}));
```

### Mock DashboardStore

```ts
const defaultStats = {
  totalProjects: 2,
  activeSessionCount: 1,
  tokensTodayTotal: 8000,
  costTodayUsd: 0.4,
  tokensWeekTotal: 50000,
  costWeekUsd: 2.5,
};

const defaultProjects = [
  { id: 'p1', name: 'Project 1', path: '/p1', lastActive: Date.now(), isActive: true, sessionCount: 2, totalTokens: 5000, totalCostUsd: 0.25, techStack: [] },
];

function createMockStore() {
  const listeners: Record<string, Function[]> = {};
  return {
    getStats: vi.fn(() => defaultStats),
    getProjects: vi.fn(() => defaultProjects),
    on: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    emit(event: string) {
      (listeners[event] ?? []).forEach(cb => cb());
    },
  };
}
```

### Mock WebviewView

```ts
function createMockWebviewView() {
  return {
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: vi.fn((handler: Function) => {
        // Store handler for later invocation in tests
        (createMockWebviewView as any)._messageHandler = handler;
        return { dispose: vi.fn() };
      }),
      postMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: any) => uri),
      cspSource: 'test-csp',
    },
  };
}
```

### beforeEach

```ts
let store: ReturnType<typeof createMockStore>;
let context: ReturnType<typeof createMockExtensionContext>;

beforeEach(() => {
  vi.clearAllMocks();
  store = createMockStore();
  context = createMockExtensionContext();
});
```

## Test Cases

### Test 1: registers as webview view provider
**Description**: The SidebarProvider class implements `vscode.WebviewViewProvider`, meaning it has a `resolveWebviewView` method.

```ts
it('registers as webview view provider', () => {
  const provider = new SidebarProvider(store as any, context as any);
  expect(typeof provider.resolveWebviewView).toBe('function');
});
```

**Assertions**:
- `resolveWebviewView` is a function on the provider instance.

### Test 2: sets webview HTML on resolve
**Description**: When `resolveWebviewView` is called with a WebviewView, it should set `webview.html` to the result of `getWebviewContent` and enable scripts.

```ts
it('sets webview HTML on resolve', () => {
  const provider = new SidebarProvider(store as any, context as any);
  const mockView = createMockWebviewView();
  provider.resolveWebviewView(mockView as any);

  expect(mockView.webview.html).toBe('<html>mock</html>');
  expect(mockView.webview.options.enableScripts).toBe(true);
});
```

**Assertions**:
- `webview.html` is set to the mock return value.
- `enableScripts` is `true`.

### Test 3: sends stateUpdate on store update
**Description**: When the store emits `'updated'`, the provider should post a `stateUpdate` message to the webview with the current projects and stats.

```ts
it('sends stateUpdate on store update', () => {
  const provider = new SidebarProvider(store as any, context as any);
  const mockView = createMockWebviewView();
  provider.resolveWebviewView(mockView as any);

  // Trigger store update
  store.emit('updated');

  expect(mockView.webview.postMessage).toHaveBeenCalledWith({
    type: 'stateUpdate',
    payload: {
      projects: defaultProjects,
      stats: defaultStats,
    },
  });
});
```

**Assertions**:
- `webview.postMessage` is called with `type: 'stateUpdate'` and the correct payload.

### Test 4: handles openDashboard message
**Description**: When the webview sends an `openDashboard` message, the provider should execute the `claudeDashboard.openDashboard` command.

```ts
it('handles openDashboard message', () => {
  const provider = new SidebarProvider(store as any, context as any);
  const mockView = createMockWebviewView();
  provider.resolveWebviewView(mockView as any);

  // Get the message handler that was registered
  const handler = mockView.webview.onDidReceiveMessage.mock.calls[0][0];
  handler({ type: 'openDashboard' });

  expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openDashboard');
});
```

**Assertions**:
- `vscode.commands.executeCommand` is called with `'claudeDashboard.openDashboard'`.

### Test 5: handles openProject message
**Description**: When the webview sends an `openProject` message with a `projectId`, the provider should execute the `claudeDashboard.openProject` command with that ID.

```ts
it('handles openProject message', () => {
  const provider = new SidebarProvider(store as any, context as any);
  const mockView = createMockWebviewView();
  provider.resolveWebviewView(mockView as any);

  const handler = mockView.webview.onDidReceiveMessage.mock.calls[0][0];
  handler({ type: 'openProject', projectId: 'p1' });

  expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1');
});
```

**Assertions**:
- `vscode.commands.executeCommand` is called with `'claudeDashboard.openProject'` and `'p1'`.

## Validation Criteria
- All 5 tests pass with `npx vitest run src/providers/__tests__/SidebarProvider.test.ts` from the project root (`claude-dashboard/`).
- The vscode mock provides `commands.executeCommand` and `Uri.joinPath`.
- The `getWebviewContent` mock prevents file system access during tests.
- The `onDidReceiveMessage` mock captures the handler so it can be invoked directly in tests.
