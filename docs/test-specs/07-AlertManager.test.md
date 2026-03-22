# Spec 07: AlertManager Unit Tests

## Target File
`src/alerts/__tests__/AlertManager.test.ts`

## Source Under Test
`src/alerts/AlertManager.ts`

## Test Framework
- Vitest (globals enabled)
- Extension-side config: `vitest.config.ts` at repo root
- Setup file `src/__tests__/setup.ts` already calls `vi.mock('vscode')` which maps to `src/__tests__/__mocks__/vscode.ts`

## Imports

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { AlertManager } from '../../alerts/AlertManager';
import * as vscode from 'vscode';
```

## Mock Setup

### Mock DashboardStore

Create a class that extends `EventEmitter` and provides stub methods. The `AlertManager` constructor calls `store.on('updated', ...)` so the mock must be an EventEmitter.

```ts
function createMockStore(overrides: {
  monthlyTokens?: number;
  monthlyUsage?: { tokens: number; costUsd: number };
  projects?: { id: string; name: string }[];
  sessionsByProject?: Record<string, { startTime: number; totalTokens: number }[]>;
} = {}) {
  const store = new EventEmitter() as EventEmitter & {
    getMonthlyTokens: ReturnType<typeof vi.fn>;
    getMonthlyUsage: ReturnType<typeof vi.fn>;
    getProjects: ReturnType<typeof vi.fn>;
    getSessions: ReturnType<typeof vi.fn>;
  };
  store.getMonthlyTokens = vi.fn(() => overrides.monthlyTokens ?? 0);
  store.getMonthlyUsage = vi.fn(() => overrides.monthlyUsage ?? { tokens: 0, costUsd: 0 });
  store.getProjects = vi.fn(() => overrides.projects ?? []);
  store.getSessions = vi.fn((projectId: string) => overrides.sessionsByProject?.[projectId] ?? []);
  return store;
}
```

### Mock ExtensionContext

Use the `createMockExtensionContext` from `src/__tests__/__mocks__/vscode.ts`, or create inline:

```ts
function createMockContext() {
  const state: Record<string, unknown> = {};
  return {
    subscriptions: [],
    extensionUri: { fsPath: '/test/ext', scheme: 'file', path: '/test/ext' },
    globalStorageUri: { fsPath: '/test/storage', scheme: 'file', path: '/test/storage' },
    globalState: {
      get: vi.fn((key: string, defaultValue?: unknown) => state[key] ?? defaultValue),
      update: vi.fn((key: string, value: unknown) => { state[key] = value; return Promise.resolve(); }),
    },
  } as any;
}
```

### Mock workspace.getConfiguration

The vscode mock's `workspace.getConfiguration` returns an object with `get()` that returns the defaultValue. Override per-test:

```ts
const mockGetConfig = vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>;
```

To set budget values, make `getConfiguration` return a custom `get`:

```ts
mockGetConfig.mockReturnValue({
  get: vi.fn((key: string) => {
    if (key === 'monthlyTokenBudget') return 1_000_000;
    if (key === 'monthlyBudgetUsd') return 50;
    return 0;
  }),
});
```

### beforeEach

```ts
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
```

---

## Test Cases (15)

### Group: Token Budget (3 cases)

#### 1. Does nothing when token budget is 0
- Setup: `monthlyTokenBudget` returns `0`, `monthlyTokens` = 500000
- Action: `store.emit('updated')`
- Assert: `vscode.window.showWarningMessage` NOT called

#### 2. Does nothing when under budget
- Setup: `monthlyTokenBudget` = 1_000_000, `monthlyTokens` = 500_000
- Action: `store.emit('updated')`
- Assert: `vscode.window.showWarningMessage` NOT called

#### 3. Shows warning when exceeded (once per 24h)
- Setup: `monthlyTokenBudget` = 1_000_000, `monthlyTokens` = 1_500_000
- Action: `store.emit('updated')`
- Assert: `vscode.window.showWarningMessage` called once with message containing `"Monthly token budget exceeded"` and `"1.50M of 1.00M"`
- Action: `store.emit('updated')` again immediately
- Assert: still called only once (24h gating)
- Action: advance time by 86_400_001ms via `vi.advanceTimersByTime(86_400_001)`, emit again
- Assert: called twice total

### Group: Cost Budget (5 cases)

#### 4. Does nothing when cost budget is 0
- Setup: `monthlyBudgetUsd` = 0, `monthlyUsage` = `{ tokens: 0, costUsd: 40 }`
- Action: `store.emit('updated')`
- Assert: `showWarningMessage` NOT called

#### 5. Does nothing when under 80%
- Setup: `monthlyBudgetUsd` = 100, `costUsd` = 70 (70%)
- Action: `store.emit('updated')`
- Assert: `showWarningMessage` NOT called

#### 6. Shows 80% warning at 80%
- Setup: `monthlyBudgetUsd` = 100, `costUsd` = 80
- Action: `store.emit('updated')`
- Assert: `showWarningMessage` called with message containing `"80% of monthly cost budget"` and `"$80.00 of $100.00"`

#### 7. Shows exceeded warning at 100%
- Setup: `monthlyBudgetUsd` = 50, `costUsd` = 55
- Action: `store.emit('updated')`
- Assert: `showWarningMessage` called with message containing `"Monthly cost budget exceeded"` and `"$55.00 of $50.00"`

#### 8. Respects 24-hour gating between cost alerts
- Setup: `monthlyBudgetUsd` = 50, `costUsd` = 55
- Action: emit twice in a row
- Assert: `showWarningMessage` called only once
- Advance time by 86_400_001ms, emit again
- Assert: called twice

### Group: Weekly Digest (7 cases)

#### 9. Only runs on Mondays
- Setup: `vi.setSystemTime(new Date('2026-03-25'))` (a Wednesday)
- Action: `alertManager.checkWeeklyDigest()`
- Assert: `showInformationMessage` NOT called
- Note: `checkWeeklyDigest()` is a public method

#### 10. Skips if last digest < 6 days ago
- Setup: Set system time to a Monday (`new Date('2026-03-23')`)
- Pre-set `globalState` with `lastWeeklyDigest` = `Date.now() - 5 * 86_400_000` (5 days ago, < 6)
- Action: `alertManager.checkWeeklyDigest()`
- Assert: `showInformationMessage` NOT called

#### 11. Calculates weekly tokens and shows info message
- Setup: Set time to Monday. Store has 1 project `{ id: 'p1', name: 'my-app' }` with sessions in the last 7 days totalling 250_000 tokens
- `sessionsByProject`: `{ p1: [{ startTime: Date.now() - 86_400_000, totalTokens: 150_000 }, { startTime: Date.now() - 2 * 86_400_000, totalTokens: 100_000 }] }`
- Action: `alertManager.checkWeeklyDigest()`
- Assert: `showInformationMessage` called with message containing `"250k tokens"` and `"1 project(s)"` and `"my-app"`

#### 12. Formats millions (1M+)
- Setup: Monday, 1 project with sessions totalling 2_500_000 tokens in last week
- Assert: message contains `"2.5M tokens"`

#### 13. Formats thousands
- Setup: Monday, 1 project with sessions totalling 45_000 tokens in last week
- Assert: message contains `"45k tokens"`

#### 14. Shows info message with token summary (multiple projects)
- Setup: Monday. 2 projects: `proj-a` (300k tokens this week), `proj-b` (200k tokens this week)
- Assert: message contains `"500k tokens"`, `"2 project(s)"`, `"proj-a"`, `"proj-b"`

#### 15. Skips if zero tokens in last week
- Setup: Monday. 1 project with sessions that are all older than 7 days
- Action: `alertManager.checkWeeklyDigest()`
- Assert: `showInformationMessage` NOT called

---

## Validation Criteria

- All 15 tests pass with `npx vitest run src/alerts/__tests__/AlertManager.test.ts`
- No real filesystem, network, or timers used
- `vi.useFakeTimers()` / `vi.setSystemTime()` used for time-dependent tests
- `vi.clearAllMocks()` in `beforeEach` to prevent cross-test leakage
- The vscode mock is auto-loaded by the setup file; do not re-mock it
