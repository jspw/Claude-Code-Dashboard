# Test Spec: toolColor utility

## Target File
`webview-ui/src/utils/__tests__/toolColor.test.ts`

## Source Under Test
`webview-ui/src/utils/toolColor.ts`

## Imports

```typescript
import { describe, it, expect } from 'vitest';
import { toolColor, TOOL_COLORS } from '../toolColor';
```

## Setup

No setup needed. Pure functions, no mocking.

## Test Cases (7 total)

### describe('toolColor')

#### 1. returns correct color for Read
- `expect(toolColor('Read')).toBe('#6366f1')`

#### 2. returns correct color for Write
- `expect(toolColor('Write')).toBe('#22c55e')`

#### 3. returns correct color for Bash
- `expect(toolColor('Bash')).toBe('#ef4444')`

#### 4. returns correct color for Agent
- `expect(toolColor('Agent')).toBe('#06b6d4')`

#### 5. returns cyan for MCP tools
- `expect(toolColor('mcp__github__search')).toBe('#06b6d4')`
- Any tool name starting with `mcp__` should return `'#06b6d4'`

#### 6. returns gray for unknown tools
- `expect(toolColor('SomeRandomTool')).toBe('#6b7280')`

### describe('TOOL_COLORS map')

#### 7. contains all 10 expected entries
- Assert `Object.keys(TOOL_COLORS).length` equals `10`
- Assert `TOOL_COLORS` contains exactly these keys:
  ```typescript
  const expectedKeys = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep', 'Agent', 'WebFetch', 'WebSearch'];
  expect(Object.keys(TOOL_COLORS).sort()).toEqual(expectedKeys.sort());
  ```
- Verify each value:
  ```typescript
  expect(TOOL_COLORS.Read).toBe('#6366f1');
  expect(TOOL_COLORS.Write).toBe('#22c55e');
  expect(TOOL_COLORS.Edit).toBe('#f59e0b');
  expect(TOOL_COLORS.MultiEdit).toBe('#f97316');
  expect(TOOL_COLORS.Bash).toBe('#ef4444');
  expect(TOOL_COLORS.Glob).toBe('#8b5cf6');
  expect(TOOL_COLORS.Grep).toBe('#ec4899');
  expect(TOOL_COLORS.Agent).toBe('#06b6d4');
  expect(TOOL_COLORS.WebFetch).toBe('#14b8a6');
  expect(TOOL_COLORS.WebSearch).toBe('#3b82f6');
  ```

## Source Reference

```typescript
export const TOOL_COLORS: Record<string, string> = {
  Read:       '#6366f1',
  Write:      '#22c55e',
  Edit:       '#f59e0b',
  MultiEdit:  '#f97316',
  Bash:       '#ef4444',
  Glob:       '#8b5cf6',
  Grep:       '#ec4899',
  Agent:      '#06b6d4',
  WebFetch:   '#14b8a6',
  WebSearch:  '#3b82f6',
};

export function toolColor(name: string): string {
  if (name.startsWith('mcp__')) { return '#06b6d4'; }
  return TOOL_COLORS[name] ?? '#6b7280';
}
```

## Validation Criteria
- All 7 tests pass
- No mocking needed
- Pure function tests
- Use exact string equality (`toBe`) for color hex values
