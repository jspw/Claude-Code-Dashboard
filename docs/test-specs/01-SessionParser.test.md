# Test Spec: SessionParser

## Target File
`src/parsers/__tests__/SessionParser.test.ts`

## Source Under Test
`src/parsers/SessionParser.ts`

## Imports

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionParser } from '../SessionParser';
import * as fs from 'fs';
import {
  MINIMAL_SESSION,
  SESSION_WITH_TOOLS,
  SESSION_WITH_THINKING,
  SESSION_WITH_MCP,
  EMPTY_CONTENT,
  MALFORMED_LINES,
  SESSION_WITH_CACHE,
  MULTI_TURN_SESSION,
  SESSION_WITH_COMMAND_MESSAGE,
  SESSION_ARRAY_CONTENT,
} from '../../__tests__/fixtures/jsonl-samples';

vi.mock('fs');
```

## Setup

```typescript
let parser: SessionParser;

beforeEach(() => {
  vi.resetAllMocks();
  parser = new SessionParser();
});
```

## Helper

Use this helper to mock `readFileSync` for a given file path:

```typescript
function mockFileContent(content: string) {
  (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(content);
}
```

## Test Cases (32 total)

### describe('readCwd')

#### 1. returns cwd from first entry
- Mock `readFileSync` to return `MINIMAL_SESSION`
- Call `parser.readCwd('/path/to/session.jsonl')`
- Assert result equals `'/home/user/project'`

#### 2. returns null on empty file
- Mock `readFileSync` to return `''`
- Call `parser.readCwd('/path/to/empty.jsonl')`
- Assert result is `null`

#### 3. returns null on read error
- Mock `readFileSync` to throw `new Error('ENOENT')`
- Call `parser.readCwd('/nonexistent.jsonl')`
- Assert result is `null`

### describe('parseFile')

#### 4. parses minimal session
- Mock `readFileSync` to return `MINIMAL_SESSION`
- Call `parser.parseFile('/sessions/abc123.jsonl', 'proj1')`
- Assert result is not null
- Assert `result.projectId` equals `'proj1'`
- Assert `result.turns.length` equals `2` (one user, one assistant)
- Assert `result.startTime` is a positive number
- Assert `result.inputTokens` equals `100`
- Assert `result.outputTokens` equals `50`

#### 5. returns null for empty content
- Mock `readFileSync` to return `EMPTY_CONTENT` (empty string)
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert result is `null`

#### 6. counts user turns as prompts
- Mock `readFileSync` to return `MULTI_TURN_SESSION`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.promptCount` equals `2`

#### 7. counts tool calls
- Mock `readFileSync` to return `SESSION_WITH_TOOLS`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.toolCallCount` equals `2`

#### 8. tracks Edit/MultiEdit as filesModified
- Mock `readFileSync` to return `SESSION_WITH_TOOLS`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.filesModified` includes `'/src/index.ts'`

#### 9. tracks Write as filesCreated
- Mock `readFileSync` to return `SESSION_WITH_TOOLS`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.filesCreated` includes `'/src/new.ts'`
- Assert `result.filesModified` also includes `'/src/new.ts'` (filesModified = modified + created)

#### 10. detects MCP tools with mcpServer field
- Mock `readFileSync` to return `SESSION_WITH_MCP`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Find the tool call in turns: `result.turns[1].toolCalls[0]`
- Assert `toolCall.name` equals `'mcp__github__search'`
- Assert `toolCall.mcpServer` equals `'github'`

#### 11. handles array content in user messages
- Mock `readFileSync` to return `SESSION_ARRAY_CONTENT`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.turns[0].content` equals `'Array content'` (text blocks joined, non-text blocks ignored)

#### 12. strips command-message tags from display text
- Mock `readFileSync` to return `SESSION_WITH_COMMAND_MESSAGE`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.turns[0].content` equals `'Real prompt here'`

#### 13. captures session summary from first meaningful user prompt
- Mock `readFileSync` to return `MINIMAL_SESSION`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.sessionSummary` equals `'Hello'`

#### 14. truncates summary at 120 chars
- Build a custom JSONL with a user message content of 200 'x' characters:
```typescript
const longContent = 'x'.repeat(200);
const longSession = [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2025-01-15T10:00:00Z', cwd: '/test', message: { content: longContent } }),
  JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2025-01-15T10:01:00Z', message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' } }),
].join('\n');
```
- Mock `readFileSync` to return `longSession`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.sessionSummary!.length` equals `121` (120 chars + 1 ellipsis character)
- Assert `result.sessionSummary` ends with the Unicode ellipsis character (not `...`)

#### 15. detects thinking blocks and counts thinking tokens
- Mock `readFileSync` to return `SESSION_WITH_THINKING`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.hasThinking` is `true`
- Assert `result.thinkingTokens` equals `5000`

#### 16. calculates totalTokens = input + cacheCreation + output (excludes cache reads)
- Mock `readFileSync` to return `SESSION_WITH_CACHE`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- SESSION_WITH_CACHE has: input=1000, output=500, cacheCreation=2000, cacheRead=15000
- Assert `result.totalTokens` equals `3500` (1000 + 2000 + 500, NOT including 15000 cache reads)
- Assert `result.inputTokens` equals `1000`
- Assert `result.cacheCreationTokens` equals `2000`
- Assert `result.cacheReadTokens` equals `15000`
- Assert `result.outputTokens` equals `500`

#### 17. calculates cacheHitRate correctly
- Mock `readFileSync` to return `SESSION_WITH_CACHE`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- totalInputForCache = 1000 + 2000 + 15000 = 18000
- cacheHitRate = round((15000 / 18000) * 1000) / 10 = 83.3
- Assert `result.cacheHitRate` equals `83.3`

#### 18. computes idle time from assistant-to-user gaps > 5min
- Build a custom JSONL with an assistant response at T=0, then a user message at T=10min (600000ms):
```typescript
const idleSession = [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2025-01-15T10:00:00Z', cwd: '/test', message: { content: 'Q1' } }),
  JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2025-01-15T10:01:00Z', message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'A1' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'end_turn' } }),
  JSON.stringify({ type: 'user', uuid: 'u2', timestamp: '2025-01-15T10:11:00Z', message: { content: 'Q2' } }),
  JSON.stringify({ type: 'assistant', uuid: 'a2', timestamp: '2025-01-15T10:12:00Z', message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'A2' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'end_turn' } }),
].join('\n');
```
- The gap between a1 (10:01) and u2 (10:11) is 10 minutes = 600000ms, which exceeds the 5-min threshold
- Mock `readFileSync` to return `idleSession`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.idleTimeMs` equals `600000`

#### 19. active session detection: end_turn uses 30-min window
- Build a JSONL where the last assistant message has `stop_reason: 'end_turn'` and timestamp is 20 minutes ago (within 30-min window):
```typescript
const now = new Date();
const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
const twentyOneMinAgo = new Date(now.getTime() - 21 * 60 * 1000).toISOString();
const activeEndTurnSession = [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: twentyOneMinAgo, cwd: '/test', message: { content: 'Hello' } }),
  JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: twentyMinAgo, message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'end_turn' } }),
].join('\n');
```
- Mock `readFileSync` to return `activeEndTurnSession`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.isActiveSession` is `true`

#### 20. active session detection: other stop reasons use 5-min window
- Build a JSONL where the last assistant message has `stop_reason: 'max_tokens'` and timestamp is 10 minutes ago (outside 5-min window):
```typescript
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const elevenMinAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
const inactiveMaxTokensSession = [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: elevenMinAgo, cwd: '/test', message: { content: 'Hello' } }),
  JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: tenMinAgo, message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'max_tokens' } }),
].join('\n');
```
- Mock `readFileSync` to return `inactiveMaxTokensSession`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert `result.isActiveSession` is `false`

#### 21. handles malformed JSON lines gracefully
- Mock `readFileSync` to return `MALFORMED_LINES`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Assert result is not null (does not throw)
- Assert `result.cwd` equals `'/test'` (from the one valid line)
- Assert `result.turns.length` equals `1` (only the valid user line)

#### 22. detects opus model
- Mock `readFileSync` to return `SESSION_WITH_THINKING` (uses `claude-opus-4`)
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Verify cost uses opus rates by checking `result.costUsd`
- Expected: (300 * 15 / 1_000_000) + (200 * 75 / 1_000_000) + (0 * 18.75 / 1_000_000) + (0 * 1.5 / 1_000_000) = 0.0045 + 0.015 = 0.0195
- Assert `result.costUsd` is approximately `0.0195`

#### 23. detects haiku model
- Build a custom JSONL with model `'claude-haiku-4'`:
```typescript
const haikuSession = [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2025-01-15T10:00:00Z', cwd: '/test', message: { content: 'Hi' } }),
  JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2025-01-15T10:01:00Z', message: { model: 'claude-haiku-4', content: [{ type: 'text', text: 'Hello' }], usage: { input_tokens: 1000, output_tokens: 500 }, stop_reason: 'end_turn' } }),
].join('\n');
```
- Mock `readFileSync` to return `haikuSession`
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Expected cost: (1000 * 0.8 / 1_000_000) + (500 * 4 / 1_000_000) = 0.0008 + 0.002 = 0.0028
- Assert `result.costUsd` is approximately `0.0028`

#### 24. defaults to sonnet model
- Mock `readFileSync` to return `MINIMAL_SESSION` (uses `claude-sonnet-4`)
- Call `parser.parseFile('/sessions/abc.jsonl', 'proj1')`
- Expected cost: (100 * 3 / 1_000_000) + (50 * 15 / 1_000_000) = 0.0003 + 0.00075 = 0.00105
- Assert `result.costUsd` is approximately `0.00105`

#### 25. sessionId comes from filename
- Mock `readFileSync` to return `MINIMAL_SESSION`
- Call `parser.parseFile('/sessions/my-session-id.jsonl', 'proj1')`
- Assert `result.id` equals `'my-session-id'`

### describe('estimateCostDetailed')

#### 26. opus rates (15/75/18.75/1.5)
- Call `parser.estimateCostDetailed(1_000_000, 1_000_000, 1_000_000, 1_000_000, 'claude-opus-4')`
- Expected: 15 + 75 + 18.75 + 1.5 = 110.25
- Assert result equals `110.25`

#### 27. sonnet rates (3/15/3.75/0.3)
- Call `parser.estimateCostDetailed(1_000_000, 1_000_000, 1_000_000, 1_000_000, 'claude-sonnet-4')`
- Expected: 3 + 15 + 3.75 + 0.3 = 22.05
- Assert result equals `22.05`

#### 28. haiku rates (0.8/4/1/0.08)
- Call `parser.estimateCostDetailed(1_000_000, 1_000_000, 1_000_000, 1_000_000, 'claude-haiku-4')`
- Expected: 0.8 + 4 + 1 + 0.08 = 5.88
- Assert result equals `5.88`

#### 29. unknown model falls back to sonnet
- Call `parser.estimateCostDetailed(1_000_000, 1_000_000, 1_000_000, 1_000_000, 'some-unknown-model')`
- Expected: same as sonnet = 22.05
- Assert result equals `22.05`

#### 30. zero tokens returns zero cost
- Call `parser.estimateCostDetailed(0, 0, 0, 0, 'claude-sonnet-4')`
- Assert result equals `0`

### describe('estimateCost')

#### 31. uses blended rate for sonnet (default)
- Call `parser.estimateCost(1_000_000, 'claude-sonnet-4')`
- Expected: (500000 * 3 / 1_000_000) + (500000 * 15 / 1_000_000) = 1.5 + 7.5 = 9.0
- Assert result equals `9`

#### 32. uses default rates when model is 'default'
- Call `parser.estimateCost(1_000_000)`
- Expected: same as sonnet = 9.0
- Assert result equals `9`

## Model Cost Reference

```
claude-opus-4:   input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5
claude-sonnet-4: input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3
claude-haiku-4:  input: 0.8, output: 4,  cacheWrite: 1,     cacheRead: 0.08
default:         input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3
```

## Validation Criteria
- All 32 tests pass
- No real filesystem access (fs is fully mocked)
- Use `toBeCloseTo` for floating-point cost assertions (2 decimal places)
- Each test is independent (beforeEach resets mocks)
