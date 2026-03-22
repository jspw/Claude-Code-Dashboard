# Spec 32: ProjectPanel Unit Tests

## Test File Path
`src/webviews/__tests__/ProjectPanel.test.ts`

## Source Under Test
`src/webviews/ProjectPanel.ts`

## Setup

### Imports
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ProjectPanel } from '../ProjectPanel';
import { createMockExtensionContext } from '../../__tests__/__mocks__/vscode';
```

### Mocks

#### Mock getWebviewContent
```typescript
vi.mock('../getWebviewContent', () => ({
  getWebviewContent: vi.fn(() => '<html>project-mock</html>'),
}));
```

#### Mock Store Factory
```typescript
function createMockStore() {
  const listeners: Record<string, Function[]> = {};
  return {
    getProject: vi.fn((id: string) => ({
      id,
      name: `Project-${id}`,
      path: `/home/user/${id}`,
      lastActive: Date.now(),
      isActive: false,
      sessionCount: 3,
      totalTokens: 10000,
      totalCostUsd: 0.5,
      techStack: ['TypeScript'],
    })),
    getSessions: vi.fn(() => [
      {
        id: 'sess-1',
        projectId: 'proj-1',
        parentSessionId: null,
        cwd: null,
        isActiveSession: false,
        startTime: 1000,
        endTime: 2000,
        durationMs: 1000,
        inputTokens: 100,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 50,
        totalTokens: 150,
        costUsd: 0.01,
        promptCount: 2,
        toolCallCount: 1,
        filesModified: [],
        filesCreated: [],
        turns: [
          { id: 't1', role: 'user', content: 'hello', inputTokens: 50, outputTokens: 0, toolCalls: [], timestamp: 1000 },
          { id: 't2', role: 'assistant', content: 'hi', inputTokens: 0, outputTokens: 50, toolCalls: [], timestamp: 1001 },
        ],
        sessionSummary: null,
        hasThinking: false,
        thinkingTokens: 0,
        cacheHitRate: 0,
        subagentCostUsd: 0,
        idleTimeMs: null,
        activeTimeMs: null,
        activityRatio: null,
      },
    ]),
    getSubagentSessions: vi.fn(() => []),
    getProjectConfig: vi.fn(() => ({
      claudeMd: null,
      mcpServers: {},
      projectSettings: {},
      commands: [],
    })),
    getProjectStats: vi.fn(() => ({
      usageOverTime: [],
      toolUsage: [],
      promptPatterns: [],
      efficiency: {
        avgTokensPerPrompt: 0, avgToolCallsPerSession: 0,
        avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0,
      },
      recentToolCalls: [],
      weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
    })),
    getProjectFiles: vi.fn(() => []),
    on: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) { listeners[event] = []; }
      listeners[event].push(cb);
    }),
    _emit: (event: string, ...args: any[]) => {
      (listeners[event] || []).forEach(cb => cb(...args));
    },
  };
}
```

#### Mock Panel Setup
```typescript
let onReceiveMessageCallback: Function;
let onDisposeCallback: Function;
let mockPanel: any;

function createMockPanel() {
  return {
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
}

beforeEach(() => {
  // Reset the static panels map
  (ProjectPanel as any).panels = new Map();

  mockPanel = createMockPanel();
  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel);
});
```

---

## Test Cases

### Test 1: createOrShow creates panel for project

**Description**: On the first call for a project ID, a new webview panel is created.

**Steps**:
1. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.

**Assertions**:
- `vscode.window.createWebviewPanel` called once.
- Called with viewType `'claudeProject.proj-1'`.
- Called with title `'Claude: Project-proj-1'` (derived from `store.getProject`).

---

### Test 2: reveals existing panel for same project

**Description**: Calling `createOrShow` with the same project ID again reveals the existing panel.

**Steps**:
1. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.
2. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')` again.

**Assertions**:
- `vscode.window.createWebviewPanel` called only once.
- `mockPanel.reveal` called once.

---

### Test 3: creates separate panels for different projects

**Description**: Different project IDs get their own panels.

**Steps**:
1. Create two different mock panels (return different panels on successive calls):
   ```typescript
   const mockPanel1 = createMockPanel();
   const mockPanel2 = createMockPanel();
   vi.mocked(vscode.window.createWebviewPanel)
     .mockReturnValueOnce(mockPanel1)
     .mockReturnValueOnce(mockPanel2);
   ```
2. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.
3. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-2')`.

**Assertions**:
- `vscode.window.createWebviewPanel` called twice.
- First call with viewType `'claudeProject.proj-1'`.
- Second call with viewType `'claudeProject.proj-2'`.

---

### Test 4: strips turns from sessions in state

**Description**: The `buildState` method maps sessions to have empty `turns` arrays (turns are loaded on demand). This is verified by inspecting the initial HTML content set via `getWebviewContent`.

**Steps**:
1. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.
2. Import and check the `getWebviewContent` mock to inspect the `initialData` argument.

**Assertions**:
- The `getWebviewContent` mock was called.
- The 4th argument (initialData) has a `sessions` array where each session has `turns: []`.
- The original store mock `getSessions` returns sessions with non-empty turns, confirming they were stripped.

```typescript
import { getWebviewContent } from '../getWebviewContent';

const calls = vi.mocked(getWebviewContent).mock.calls;
const initialData = calls[0][3] as any;
expect(initialData.sessions[0].turns).toEqual([]);
```

---

### Test 5: handles exportSessions message

**Description**: When the webview sends an `exportSessions` message, the panel executes the export command.

**Steps**:
1. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.
2. Simulate message: `await onReceiveMessageCallback({ type: 'exportSessions', format: 'csv' })`.

**Assertions**:
- `vscode.commands.executeCommand` called with `'claudeDashboard.exportSessions'`, `'proj-1'`, and `'csv'`.

---

### Test 6: handles getSessionTurns message by returning turns

**Description**: When the webview sends a `getSessionTurns` message, the panel responds with the full session turns.

**Steps**:
1. Call `ProjectPanel.createOrShow(mockContext, mockStore as any, 'proj-1')`.
2. Simulate message: `await onReceiveMessageCallback({ type: 'getSessionTurns', sessionId: 'sess-1' })`.

**Assertions**:
- `mockPanel.webview.postMessage` called with:
  ```typescript
  {
    type: 'sessionTurns',
    sessionId: 'sess-1',
    turns: [
      { id: 't1', role: 'user', content: 'hello', inputTokens: 50, outputTokens: 0, toolCalls: [], timestamp: 1000 },
      { id: 't2', role: 'assistant', content: 'hi', inputTokens: 0, outputTokens: 50, toolCalls: [], timestamp: 1001 },
    ],
  }
  ```

---

## Validation Criteria
- All 6 tests pass with `npx vitest run src/webviews/__tests__/ProjectPanel.test.ts`.
- The vscode mock is provided by the global setup.
- `getWebviewContent` is mocked at the module level.
- The static `panels` map is cleared before each test.
