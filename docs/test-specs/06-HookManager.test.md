# Test Spec: HookManager

## Target File
`src/hooks/__tests__/HookManager.test.ts`

## Source Under Test
`src/hooks/HookManager.ts`

## Imports

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookManager } from '../HookManager';
import * as fs from 'fs';

vi.mock('fs');
```

## Setup

```typescript
let manager: HookManager;
let mockGlobalState: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.resetAllMocks();
  manager = new HookManager('/home/user/.claude');
  mockGlobalState = {
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  };
});
```

## Constants

The source uses `HOOK_VERSION = 2`. The hook command writes to `.dashboard-events.jsonl`. These are important for assertions.

```typescript
const HOOK_VERSION = 2;
const DASHBOARD_EVENTS_MARKER = '.dashboard-events.jsonl';
```

## Test Cases (10 total)

### describe('needsReinjection')

#### 1. returns true when no stored version
- `mockGlobalState.get.mockReturnValue(undefined)`
- `const result = manager.needsReinjection(mockGlobalState)`
- Assert `result` is `true`
- Assert `mockGlobalState.get` was called with `'dashboardHookVersion'`

#### 2. returns true when version mismatch
- `mockGlobalState.get.mockReturnValue(1)` (old version, current is 2)
- `const result = manager.needsReinjection(mockGlobalState)`
- Assert `result` is `true`

#### 3. returns false when version matches
- `mockGlobalState.get.mockReturnValue(HOOK_VERSION)` (returns 2)
- `const result = manager.needsReinjection(mockGlobalState)`
- Assert `result` is `false`

### describe('injectHooks')

#### 4. creates settings file if missing
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false)`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Assert `fs.writeFileSync` was called
- Parse the written content (second argument of writeFileSync call):
  ```typescript
  const writtenContent = JSON.parse((fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1]);
  ```
- Assert `writtenContent.hooks` is defined
- Assert `writtenContent.hooks.PostToolUse` is an array with length > 0
- Assert `writtenContent.hooks.Stop` is an array with length > 0

#### 5. backs up before modifying
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({}))`
- `(fs.copyFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Assert `fs.copyFileSync` was called
- Assert the first argument ends with `'settings.json'`
- Assert the second argument ends with `'settings.json.bak'`

#### 6. adds PostToolUse hook
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false)`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Parse written content
- Assert `writtenContent.hooks.PostToolUse` is an array
- Assert `writtenContent.hooks.PostToolUse.length` equals `1`
- Assert `writtenContent.hooks.PostToolUse[0]` has property `matcher` equal to `'*'`
- Assert `writtenContent.hooks.PostToolUse[0].hooks[0].type` equals `'command'`
- Assert `writtenContent.hooks.PostToolUse[0].hooks[0].command` contains `'.dashboard-events.jsonl'`

#### 7. adds Stop hook
- Same setup as test 6
- Assert `writtenContent.hooks.Stop` is an array
- Assert `writtenContent.hooks.Stop.length` equals `1`
- Assert `writtenContent.hooks.Stop[0].hooks[0].type` equals `'command'`
- Assert `writtenContent.hooks.Stop[0].hooks[0].command` contains `'.dashboard-events.jsonl'`

#### 8. removes old dashboard hooks before re-adding
- Provide existing settings with an old dashboard hook:
```typescript
const existingSettings = {
  hooks: {
    PostToolUse: [
      { matcher: '*', hooks: [{ type: 'command', command: 'old command with .dashboard-events.jsonl' }] },
    ],
    Stop: [
      { hooks: [{ type: 'command', command: 'old stop .dashboard-events.jsonl' }] },
    ],
  },
};
```
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingSettings))`
- `(fs.copyFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Parse written content
- Assert `writtenContent.hooks.PostToolUse.length` equals `1` (old one removed, new one added)
- Assert `writtenContent.hooks.Stop.length` equals `1` (old one removed, new one added)

#### 9. preserves non-dashboard hooks
- Provide existing settings with a custom (non-dashboard) hook:
```typescript
const existingSettings = {
  hooks: {
    PostToolUse: [
      { matcher: '*.py', hooks: [{ type: 'command', command: 'python linter' }] },
      { matcher: '*', hooks: [{ type: 'command', command: 'old .dashboard-events.jsonl hook' }] },
    ],
  },
};
```
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `(fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingSettings))`
- `(fs.copyFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Parse written content
- Assert `writtenContent.hooks.PostToolUse.length` equals `2` (1 custom + 1 new dashboard)
- Find the custom hook entry and assert its command is `'python linter'` (preserved)

#### 10. updates globalState version
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false)`
- `(fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {})`
- `await manager.injectHooks(mockGlobalState)`
- Assert `mockGlobalState.update` was called with `'dashboardHookVersion'` and `HOOK_VERSION` (which is `2`)

## Source Reference

```typescript
const HOOK_COMMAND = `node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const e=JSON.parse(d);const line=JSON.stringify({type:e.hook_event_name,tool:e.tool_name,sessionId:e.session_id,timestamp:Date.now()})+'\\n';require('fs').appendFileSync(require('path').join(require('os').homedir(),'.claude','.dashboard-events.jsonl'),line)}catch(err){}})"`;

const HOOK_VERSION = 2;

export class HookManager {
  private claudeDir: string;

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
  }

  needsReinjection(globalState: { get(key: string): unknown }): boolean {
    const storedVersion = globalState.get('dashboardHookVersion') as number | undefined;
    return storedVersion !== HOOK_VERSION;
  }

  async injectHooks(globalState?: { get(key: string): unknown; update(key: string, value: unknown): Thenable<void> }): Promise<void> {
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    let settings: Record<string, unknown> = {};

    if (fs.existsSync(settingsPath)) {
      try {
        fs.copyFileSync(settingsPath, settingsPath + '.bak');
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch { settings = {}; }
    }

    const dashboardHook = { type: 'command', command: HOOK_COMMAND };
    const hooks = (settings.hooks as Record<string, unknown[]>) || {};

    const removeOldHooks = (arr: unknown[]): unknown[] =>
      arr.filter(h => !JSON.stringify(h).includes('.dashboard-events.jsonl'));

    const postToolUse = removeOldHooks((hooks.PostToolUse as unknown[]) || []);
    postToolUse.push({ matcher: '*', hooks: [dashboardHook] });
    hooks.PostToolUse = postToolUse;

    const stopHooks = removeOldHooks((hooks.Stop as unknown[]) || []);
    stopHooks.push({ hooks: [dashboardHook] });
    hooks.Stop = stopHooks;

    settings.hooks = hooks;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    if (globalState) {
      await globalState.update('dashboardHookVersion', HOOK_VERSION);
    }
  }
}
```

## Validation Criteria
- All 10 tests pass
- No real filesystem access (fs is fully mocked)
- Each test is independent (beforeEach resets mocks)
- Use `JSON.parse()` on the content passed to `writeFileSync` to verify the structure
- Verify `copyFileSync` is called before `writeFileSync` (backup happens first)
- Use `toHaveBeenCalledWith` for globalState assertions
