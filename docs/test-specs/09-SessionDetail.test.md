# Spec 09: SessionDetail Unit Tests

## Target File
`webview-ui/src/components/__tests__/SessionDetail.test.tsx`

## Source Under Test
`webview-ui/src/components/SessionDetail.tsx` (default export `SessionDetail`)

Props: `{ session: Session; turns: Turn[]; loading: boolean }`

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../helpers/render-helpers';
import SessionDetail from '../../components/SessionDetail';
import { makeSession, makeTurn, makeToolCall } from '../fixtures/test-data';
```

## Mock Setup

The component imports `formatTokens` and `formatDuration` from `../../utils/format` and `toolColor` from `../../utils/toolColor`. These are pure functions that do not need mocking.

The component imports `MarkdownView` from `./MarkdownView`. No mock needed -- let it render naturally.

No `vi.mock()` calls required for this test file.

---

## Sample Data

```ts
const baseSession = makeSession({
  startTime: new Date('2026-03-20T10:00:00').getTime(),
  endTime: new Date('2026-03-20T11:00:00').getTime(),
  durationMs: 3_600_000,
  totalTokens: 18000,
  costUsd: 0.25,
  inputTokens: 10000,
  cacheCreationTokens: 5000,
  cacheReadTokens: 50000,
  outputTokens: 3000,
  filesModified: ['/src/index.ts', '/src/utils.ts'],
  filesCreated: ['/src/utils.ts'],
  hasThinking: false,
  thinkingTokens: 0,
  subagentCostUsd: 0,
  cacheHitRate: 76.9,
});
```

---

## Test Cases (15)

### Group: Loading State (1 case)

#### 1. Shows "Loading turns..." when loading=true
- Render: `<SessionDetail session={baseSession} turns={[]} loading={true} />`
- Assert: `screen.getByText('Loading turns...')` is in the document

### Group: Empty State (1 case)

#### 2. Shows "No turns recorded" when turns is empty
- Render: `<SessionDetail session={baseSession} turns={[]} loading={false} />`
- Assert: `screen.getByText(/No turns recorded/)` is in the document

### Group: User Turns (1 case)

#### 3. Renders user content with "You" label
- Create turn: `makeTurn({ role: 'user', content: 'Fix the bug please' })`
- Render: `<SessionDetail session={baseSession} turns={[turn]} loading={false} />`
- Assert: `screen.getByText('You')` is in the document
- Assert: `screen.getByText('Fix the bug please')` is in the document

### Group: Assistant Turns (1 case)

#### 4. Renders assistant content with "Claude" label
- Create turn: `makeTurn({ role: 'assistant', content: 'I fixed the bug.' })`
- Render with `turns=[turn]`, `loading=false`
- Assert: `screen.getByText('Claude')` is in the document
- Assert: `screen.getByText('I fixed the bug.')` is in the document

### Group: Tool Badges (2 cases)

#### 5. Renders tool name with color
- Create turn: `makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'Read', input: { file_path: '/src/index.ts' } })] })`
- Render
- Assert: `screen.getByText('Read')` is in the document

#### 6. Renders MCP tool with server/tool format
- Create turn: `makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'mcp__github__create_issue', input: {} })] })`
- Render
- Assert: `screen.getByText('github/create_issue')` is in the document (the component strips `mcp__` prefix and replaces `__` with `/`)

### Group: Agent Blocks (1 case)

#### 7. Renders Agent call with "subagent" badge and prompt content
- Create turn: `makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'Agent', input: { prompt: 'Investigate the error logs' } })] })`
- Render
- Assert: `screen.getByText('Agent')` is in the document
- Assert: `screen.getByText('subagent')` is in the document
- Assert: `screen.getByText('Investigate the error logs')` is in the document

### Group: Metadata (1 case)

#### 8. Shows date, duration, tokens, cost
- Use `baseSession` with known values: `durationMs: 3_600_000`, `totalTokens: 18000`, `costUsd: 0.25`
- Render with empty turns, loading=false
- Assert: `screen.getByText('1h 0m')` exists (formatted duration)
- Assert: `screen.getByText('18.0k tokens')` exists (formatted tokens)
- Assert: `screen.getByText('$0.2500')` exists (total cost = costUsd + subagentCostUsd)

### Group: Files (1 case)

#### 9. Shows modified files with icons
- Use `baseSession` with `filesModified: ['/src/index.ts', '/src/utils.ts']`, `filesCreated: ['/src/utils.ts']`
- Render
- Assert: `screen.getByText('Files touched')` is in the document
- Assert: `screen.getByText(/index\.ts/)` is in the document
- Assert: `screen.getByText(/utils\.ts/)` is in the document

### Group: System Events (3 cases)

#### 10. Renders command events
- Create user turn with content: `<command-name>git status</command-name><command-args>--short</command-args>`
- Render
- Assert: `screen.getByText('git status')` is in the document
- Assert: `screen.getByText('--short')` is in the document

#### 11. Renders stdout events
- Create user turn with content: `<local-command-stdout>Build successful</local-command-stdout>`
- Render
- Assert: `screen.getByText('Build successful')` is in the document

#### 12. Skips local-command-caveat-only turns
- Create user turn with content: `<local-command-caveat>Some caveat text</local-command-caveat>`
- Render with this as the only turn
- Assert: the turn content is NOT rendered (no "Some caveat text" in document)
- The component should return null for this turn, so check that no user bubble appears beyond metadata

### Group: Indicators (3 cases)

#### 13. Shows cache indicator when cacheReadTokens > 0
- Use session with `cacheReadTokens: 50000`
- Render
- Assert: `screen.getByText(/cached/)` is in the document (shows "+50.0k cached")

#### 14. Shows thinking indicator when hasThinking
- Use session with `hasThinking: true, thinkingTokens: 5000`
- Render
- Assert: text matching `/thinking/` is in the document

#### 15. Shows subagent cost when subagentCostUsd > 0
- Use session with `subagentCostUsd: 0.15`
- Render
- Assert: `screen.getByText(/subagents/)` is in the document
- Assert: text contains `"$0.1500"`

---

## Validation Criteria

- All 15 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/SessionDetail.test.tsx`
- Uses `makeSession`, `makeTurn`, `makeToolCall` fixtures from `../fixtures/test-data`
- No external mocks needed -- all imported utils are pure functions
- Date-dependent assertions should use a fixed `startTime` timestamp for consistency
