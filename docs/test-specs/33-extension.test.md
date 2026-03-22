# Spec 33: extension.ts Unit Tests

## Test File Path
`src/__tests__/extension.test.ts`

## Source Under Test
`src/extension.ts`

## Setup

### Imports
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { createMockExtensionContext } from './__mocks__/vscode';
```

### Module Mocks

Mock all dependencies that `extension.ts` imports. Each mock should return a constructor (class) that creates a mock instance:

```typescript
vi.mock('fs');
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

const mockStore = {
  initialize: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn(),
  getProjects: vi.fn(() => [{ id: 'p1', name: 'test-project' }]),
  getProject: vi.fn(),
  getSessions: vi.fn(() => []),
  on: vi.fn(),
};
vi.mock('../store/DashboardStore', () => ({
  DashboardStore: vi.fn(() => mockStore),
}));

const mockFileWatcher = { start: vi.fn() };
vi.mock('../watchers/FileWatcher', () => ({
  FileWatcher: vi.fn(() => mockFileWatcher),
}));

const mockEventWatcher = { start: vi.fn() };
vi.mock('../watchers/EventWatcher', () => ({
  EventWatcher: vi.fn(() => mockEventWatcher),
}));

const mockHookManager = {
  injectHooks: vi.fn().mockResolvedValue(undefined),
  needsReinjection: vi.fn(() => false),
};
vi.mock('../hooks/HookManager', () => ({
  HookManager: vi.fn(() => mockHookManager),
}));

vi.mock('../providers/SidebarProvider', () => ({
  SidebarProvider: vi.fn(() => ({})),
}));

const mockStatusBar = { dispose: vi.fn() };
vi.mock('../providers/StatusBarProvider', () => ({
  StatusBarProvider: vi.fn(() => mockStatusBar),
}));

const mockDashboardPanel = { createOrShow: vi.fn() };
vi.mock('../webviews/DashboardPanel', () => ({
  DashboardPanel: mockDashboardPanel,
}));

const mockProjectPanel = { createOrShow: vi.fn() };
vi.mock('../webviews/ProjectPanel', () => ({
  ProjectPanel: mockProjectPanel,
}));

const mockAlertManager = { checkWeeklyDigest: vi.fn() };
vi.mock('../alerts/AlertManager', () => ({
  AlertManager: vi.fn(() => mockAlertManager),
}));
```

### Import the module under test AFTER mocks are set up
```typescript
import { activate, deactivate } from '../extension';
```

### beforeEach
```typescript
let mockContext: ReturnType<typeof createMockExtensionContext>;

beforeEach(() => {
  vi.clearAllMocks();
  mockContext = createMockExtensionContext();
  // Default: hooks not configured (first run)
  mockContext.globalState.get.mockImplementation((key: string, defaultValue?: unknown) => {
    if (key === 'hooksConfigured') return false;
    return defaultValue;
  });
  // Default: user skips hooks prompt
  vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as any);
});
```

---

## Test Cases

### Test 1: activate creates DashboardStore

**Description**: The `activate` function instantiates a `DashboardStore` with the claude directory and global storage path.

**Steps**:
1. Import `DashboardStore` constructor mock.
2. Call `await activate(mockContext as any)`.

**Assertions**:
- `DashboardStore` constructor called once.
- Called with args: first arg ends with `.claude`, second arg is `mockContext.globalStorageUri.fsPath`.

```typescript
import { DashboardStore } from '../store/DashboardStore';
expect(DashboardStore).toHaveBeenCalledOnce();
expect(vi.mocked(DashboardStore).mock.calls[0][0]).toContain('.claude');
```

---

### Test 2: activate creates HookManager

**Description**: The `activate` function creates a `HookManager` with the claude directory.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `HookManager` constructor called once.
- First arg contains `.claude`.

```typescript
import { HookManager } from '../hooks/HookManager';
expect(HookManager).toHaveBeenCalledOnce();
```

---

### Test 3: activate registers sidebar provider

**Description**: The sidebar webview view provider is registered with the correct view ID.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `vscode.window.registerWebviewViewProvider` called once.
- First arg is `'claudeDashboard.sidebar'`.

---

### Test 4: activate registers commands (openDashboard, openProject, refresh, exportSessions)

**Description**: Four commands are registered via `vscode.commands.registerCommand`.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `vscode.commands.registerCommand` called at least 4 times.
- The registered command names include:
  - `'claudeDashboard.openDashboard'`
  - `'claudeDashboard.openProject'`
  - `'claudeDashboard.refresh'`
  - `'claudeDashboard.exportSessions'`

Extract command names from mock calls:
```typescript
const registeredCommands = vi.mocked(vscode.commands.registerCommand).mock.calls.map(c => c[0]);
expect(registeredCommands).toContain('claudeDashboard.openDashboard');
expect(registeredCommands).toContain('claudeDashboard.openProject');
expect(registeredCommands).toContain('claudeDashboard.refresh');
expect(registeredCommands).toContain('claudeDashboard.exportSessions');
```

---

### Test 5: activate starts watchers

**Description**: Both `FileWatcher.start` and `EventWatcher.start` are called with the extension context.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `mockFileWatcher.start` called once with `mockContext`.
- `mockEventWatcher.start` called once with `mockContext`.

---

### Test 6: activate calls store.initialize()

**Description**: The store's `initialize` method is called during activation.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `mockStore.initialize` called once.

---

### Test 7: activate opens dashboard on activation

**Description**: After initialization, `DashboardPanel.createOrShow` is called to automatically open the dashboard.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `mockDashboardPanel.createOrShow` called once.
- Called with `mockContext` as first arg and the store as second arg.

---

### Test 8: activate checks weekly digest

**Description**: `AlertManager.checkWeeklyDigest` is called during activation.

**Steps**:
1. Call `await activate(mockContext as any)`.

**Assertions**:
- `mockAlertManager.checkWeeklyDigest` called once.

---

### Test 9: activate prompts for hooks on first run

**Description**: When `hooksConfigured` is `false` in global state, the user is prompted to configure hooks. If they accept, `hookManager.injectHooks` is called and the state is updated.

**Steps**:
1. Set `mockContext.globalState.get` to return `false` for `'hooksConfigured'`.
2. Mock `vscode.window.showInformationMessage` to resolve with `'Yes, configure hooks'`.
3. Call `await activate(mockContext as any)`.

**Assertions**:
- `vscode.window.showInformationMessage` called with a string containing `'Auto-configure real-time hooks'` (or similar).
- `mockHookManager.injectHooks` called once.
- `mockContext.globalState.update` called with `'hooksConfigured'` and `true`.

---

### Test 10: deactivate is a no-op function

**Description**: The `deactivate` function exists and does nothing (returns `undefined`).

**Steps**:
1. Call `deactivate()`.

**Assertions**:
- `deactivate()` returns `undefined`.
- No errors are thrown.
- `typeof deactivate` is `'function'`.

---

## Validation Criteria
- All 10 tests pass with `npx vitest run src/__tests__/extension.test.ts`.
- All module dependencies are mocked; no real filesystem, OS, or VS Code API calls.
- The vscode mock from `src/__tests__/__mocks__/vscode.ts` is used via the global setup.
- Mock instances are cleared between tests via `vi.clearAllMocks()` in `beforeEach`.
