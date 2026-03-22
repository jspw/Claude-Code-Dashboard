# Test Spec: DashboardStore

## Target File
`src/store/__tests__/DashboardStore.test.ts`

## Source Under Test
`src/store/DashboardStore.ts`

## Imports

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardStore, Session, Project, LiveEvent } from '../DashboardStore';
import { createPopulatedStore } from '../../__tests__/helpers/store-helpers';
import { makeProject, makeSession, makeTurn, makeToolCall } from '../../__tests__/fixtures/sessions';
import * as fs from 'fs';
import * as os from 'os';

vi.mock('fs');
vi.mock('os');
```

## Setup

```typescript
let store: DashboardStore;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // Set "now" to a known date for deterministic tests
  vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  (os.homedir as ReturnType<typeof vi.fn>).mockReturnValue('/home/testuser');
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Constants for Test Data

```typescript
const NOW = new Date('2025-01-15T12:00:00Z').getTime();
const ONE_HOUR = 3_600_000;
const ONE_DAY = 86_400_000;
const ONE_WEEK = 7 * ONE_DAY;
```

## Test Cases (70 total)

### describe('construction')

#### 1. creates without error
- `const store = new DashboardStore('/tmp/fake-claude-dir')`
- Assert no error is thrown

### describe('getProjects')

#### 2. returns empty array initially
- `const store = new DashboardStore('/tmp/fake-claude-dir')`
- Assert `store.getProjects()` returns `[]`

#### 3. returns sorted by lastActive desc
- Create two projects:
  - `projA = makeProject({ id: 'a', name: 'A', lastActive: NOW - ONE_DAY })`
  - `projB = makeProject({ id: 'b', name: 'B', lastActive: NOW })`
- `store = createPopulatedStore([projA, projB], { a: [], b: [] })`
- Assert `store.getProjects()[0].id` equals `'b'` (most recent first)
- Assert `store.getProjects()[1].id` equals `'a'`

#### 4. handles multiple projects
- Create 3 projects with different ids
- `store = createPopulatedStore([p1, p2, p3], { [p1.id]: [], [p2.id]: [], [p3.id]: [] })`
- Assert `store.getProjects().length` equals `3`

### describe('getProject')

#### 5. returns project by id
- `proj = makeProject({ id: 'my-proj' })`
- `store = createPopulatedStore([proj], { 'my-proj': [] })`
- Assert `store.getProject('my-proj')` deep-equals `proj`

#### 6. returns undefined for unknown id
- `store = createPopulatedStore([], {})`
- Assert `store.getProject('nonexistent')` is `undefined`

### describe('getSessions')

#### 7. returns sessions for project
- `proj = makeProject({ id: 'p1' })`
- `session = makeSession({ projectId: 'p1' })`
- `store = createPopulatedStore([proj], { p1: [session] })`
- Assert `store.getSessions('p1').length` equals `1`

#### 8. returns empty for unknown project
- `store = createPopulatedStore([], {})`
- Assert `store.getSessions('unknown')` returns `[]`

### describe('getSubagentSessions')

#### 9. returns subagent sessions
- `proj = makeProject({ id: 'p1' })`
- `sub = makeSession({ projectId: 'p1', parentSessionId: 'parent-1' })`
- `store = createPopulatedStore([proj], { p1: [] }, { p1: [sub] })`
- Assert `store.getSubagentSessions('p1').length` equals `1`

#### 10. returns empty for unknown project
- `store = createPopulatedStore([], {})`
- Assert `store.getSubagentSessions('unknown')` returns `[]`

### describe('getStats')

#### 11. returns zero stats when empty
- `store = createPopulatedStore([], {})`
- `const stats = store.getStats()`
- Assert `stats.totalProjects` equals `0`
- Assert `stats.activeSessionCount` equals `0`
- Assert `stats.tokensTodayTotal` equals `0`
- Assert `stats.costTodayUsd` equals `0`

#### 12. counts active sessions
- Create a project with 2 sessions: one active, one not
- `s1 = makeSession({ isActiveSession: true, projectId: 'p1' })`
- `s2 = makeSession({ isActiveSession: false, projectId: 'p1' })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- Assert `store.getStats().activeSessionCount` equals `1`

#### 13. sums today's tokens (sessions within 24h)
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, totalTokens: 5000, costUsd: 0.1 })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - 2 * ONE_DAY, totalTokens: 10000, costUsd: 0.5 })` (older than 24h)
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- Assert `store.getStats().tokensTodayTotal` equals `5000`

#### 14. sums week's tokens (sessions within 7d)
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, totalTokens: 5000 })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - 3 * ONE_DAY, totalTokens: 3000 })`
- `s3 = makeSession({ projectId: 'p1', startTime: NOW - 10 * ONE_DAY, totalTokens: 9000 })` (older than 7d)
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2, s3] })`
- Assert `store.getStats().tokensWeekTotal` equals `8000`

#### 15. calculates today's cost
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, costUsd: 0.15 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- Assert `store.getStats().costTodayUsd` is approximately `0.15`

#### 16. calculates week's cost
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, costUsd: 0.1 })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - 3 * ONE_DAY, costUsd: 0.2 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- Assert `store.getStats().costWeekUsd` is approximately `0.3`

### describe('getUsageOverTime')

#### 17. returns array of length=days
- `store = createPopulatedStore([], {})`
- Assert `store.getUsageOverTime(7).length` equals `7`
- Assert `store.getUsageOverTime(30).length` equals `30`

#### 18. sums tokens per day
- Create a session that started 1 hour ago with 5000 tokens
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, totalTokens: 5000, costUsd: 0.1 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- `const data = store.getUsageOverTime(7)`
- Assert the last entry (`data[6]`) has `tokens: 5000`

#### 19. returns zeros for days with no sessions
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [] })`
- `const data = store.getUsageOverTime(7)`
- Assert every entry has `tokens: 0` and `costUsd: 0`

### describe('getUsageByProject')

#### 20. sorts by tokens desc
- `p1 = makeProject({ id: 'p1', name: 'Small', totalTokens: 1000, totalCostUsd: 0.1 })`
- `p2 = makeProject({ id: 'p2', name: 'Big', totalTokens: 5000, totalCostUsd: 0.5 })`
- `store = createPopulatedStore([p1, p2], { p1: [], p2: [] })`
- `const data = store.getUsageByProject()`
- Assert `data[0].name` equals `'Big'`
- Assert `data[1].name` equals `'Small'`

#### 21. limits to 10 projects
- Create 12 projects with unique ids
- `store = createPopulatedStore(projects, sessionsMap)`
- Assert `store.getUsageByProject().length` equals `10`

### describe('getHeatmapData')

#### 22. returns 7*24=168 entries
- `store = createPopulatedStore([], {})`
- Assert `store.getHeatmapData().length` equals `168`

#### 23. maps sessions to correct hour/day
- Create a session starting on a known day/hour (use `new Date('2025-01-15T14:00:00Z')` which is a Wednesday=3, hour=14 in UTC)
- NOTE: The hour will depend on local timezone. Use `new Date(NOW).getHours()` and `new Date(NOW).getDay()` to determine expected values.
- `s1 = makeSession({ projectId: 'p1', startTime: NOW, totalTokens: 1000 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- Find the entry matching the expected day/hour and assert its `tokens` equals `1000`

### describe('searchPrompts')

#### 24. returns empty for empty query
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1' })] })`
- Assert `store.searchPrompts('')` returns `[]`
- Assert `store.searchPrompts('   ')` returns `[]`

#### 25. matches content case-insensitive
- Create a session with a user turn containing `'Fix the BUG in index.ts'`
- `turn = makeTurn({ role: 'user', content: 'Fix the BUG in index.ts' })`
- `session = makeSession({ projectId: 'p1', turns: [turn] })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [session] })`
- Assert `store.searchPrompts('bug').length` equals `1`
- Assert `store.searchPrompts('BUG').length` equals `1`

#### 26. builds snippet with context
- Create a turn with long content: `'Here is some context before the keyword TARGET and some after'`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1', turns: [makeTurn({ role: 'user', content: 'Here is some context before the keyword TARGET and some after' })] })] })`
- `const results = store.searchPrompts('TARGET')`
- Assert `results[0].snippet` contains `'TARGET'`

#### 27. only searches user turns
- Create a session with user turn (content: 'hello') and assistant turn (content: 'hello')
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1', turns: [makeTurn({ role: 'user', content: 'hello world' }), makeTurn({ role: 'assistant', content: 'hello back' })] })] })`
- Assert `store.searchPrompts('hello').length` equals `1` (only user turn matched)

### describe('getPromptPatterns')

#### 28. categorizes fix/bug prompts
- `turn = makeTurn({ role: 'user', content: 'fix the broken test' })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1', turns: [turn] })] })`
- Find `'Fix/Bug'` category and assert count is `1`

#### 29. categorizes explain prompts
- `turn = makeTurn({ role: 'user', content: 'explain how this works' })`
- Setup store, assert `'Explain'` count is `1`

#### 30. categorizes refactor prompts
- `turn = makeTurn({ role: 'user', content: 'refactor the auth module' })`
- Setup store, assert `'Refactor'` count is `1`

#### 31. categorizes feature prompts
- `turn = makeTurn({ role: 'user', content: 'add a new login page' })`
- Setup store, assert `'Feature'` count is `1`

#### 32. categorizes test prompts
- `turn = makeTurn({ role: 'user', content: 'write unit tests for the parser' })`
- Setup store, assert `'Test'` count is `1`

#### 33. categorizes other prompts
- `turn = makeTurn({ role: 'user', content: 'thanks for the help' })`
- Setup store, assert `'Other'` count is `1`

### describe('getToolUsageStats')

#### 34. returns empty for no tools
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1', turns: [makeTurn({ role: 'user' })] })] })`
- Assert `store.getToolUsageStats()` returns `[]`

#### 35. counts tool usage across sessions
- Create 2 sessions, each with an assistant turn that has tool calls:
  - Session 1: `[makeToolCall({ name: 'Read' }), makeToolCall({ name: 'Write' })]`
  - Session 2: `[makeToolCall({ name: 'Read' })]`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- `const stats = store.getToolUsageStats()`
- Find `'Read'` and assert count is `2`
- Find `'Write'` and assert count is `1`

#### 36. calculates percentages
- Same setup as above. Total tool calls = 3.
- Read percentage = round((2/3) * 100 * 10) / 10 = 66.7
- Assert Read entry has `percentage` approximately `66.7`

#### 37. sorts by count desc
- Same setup as above
- Assert `stats[0].tool` equals `'Read'` (count=2, highest)

### describe('getHotFiles')

#### 38. aggregates file edits across sessions
- Create 2 sessions both modifying `/src/index.ts`:
  - `s1 = makeSession({ projectId: 'p1', filesModified: ['/src/index.ts'] })`
  - `s2 = makeSession({ projectId: 'p1', filesModified: ['/src/index.ts', '/src/utils.ts'] })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- `const files = store.getHotFiles()`
- Find `/src/index.ts` and assert `editCount` is `2`

#### 39. sorts by editCount desc
- Same setup. Assert `files[0].fullPath` equals `'/src/index.ts'` (2 edits vs 1)

#### 40. limits to specified count
- Create sessions with 5 different files modified
- `store.getHotFiles(2).length` equals `2`

### describe('getProjectedCost')

#### 41. calculates daily average
- Create a session starting on Jan 15 (day 15 of month) with costUsd: 1.5
- `s1 = makeSession({ projectId: 'p1', startTime: NOW, costUsd: 1.5 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- `const projected = store.getProjectedCost()`
- `daysElapsed = 15` (January 15)
- `dailyAvgCost = 1.5 / 15 = 0.1`
- Assert `projected.dailyAvgCost` is approximately `0.1`

#### 42. projects month cost
- Same setup. `projectedMonthCost = 0.1 * 31 = 3.1`
- Assert `projected.projectedMonthCost` is approximately `3.1`

### describe('getStreak')

#### 43. returns 0 streak when empty
- `store = createPopulatedStore([], {})`
- `const streak = store.getStreak()`
- Assert `streak.currentStreak` equals `0`
- Assert `streak.longestStreak` equals `0`
- Assert `streak.totalActiveDays` equals `0`

#### 44. counts consecutive days from today
- Create sessions on today, yesterday, and day-before-yesterday:
  - `s1 = makeSession({ projectId: 'p1', startTime: NOW })`
  - `s2 = makeSession({ projectId: 'p1', startTime: NOW - ONE_DAY })`
  - `s3 = makeSession({ projectId: 'p1', startTime: NOW - 2 * ONE_DAY })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2, s3] })`
- Assert `store.getStreak().currentStreak` equals `3`

#### 45. finds longest streak
- Create sessions with a gap:
  - Days: today, yesterday (streak of 2), then 5-days-ago, 6-days-ago, 7-days-ago (streak of 3)
  - `s1 = makeSession({ projectId: 'p1', startTime: NOW })`
  - `s2 = makeSession({ projectId: 'p1', startTime: NOW - ONE_DAY })`
  - `s3 = makeSession({ projectId: 'p1', startTime: NOW - 5 * ONE_DAY })`
  - `s4 = makeSession({ projectId: 'p1', startTime: NOW - 6 * ONE_DAY })`
  - `s5 = makeSession({ projectId: 'p1', startTime: NOW - 7 * ONE_DAY })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2, s3, s4, s5] })`
- Assert `store.getStreak().longestStreak` equals `3`

### describe('getEfficiencyStats')

#### 46. calculates avg tokens per prompt
- `s1 = makeSession({ projectId: 'p1', totalTokens: 1000, promptCount: 5 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- Assert `store.getEfficiencyStats().avgTokensPerPrompt` equals `200`

#### 47. avg tool calls per session
- `s1 = makeSession({ projectId: 'p1', toolCallCount: 10 })`
- `s2 = makeSession({ projectId: 'p1', toolCallCount: 20 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- Assert `store.getEfficiencyStats().avgToolCallsPerSession` equals `15`

#### 48. avg session duration
- `s1 = makeSession({ projectId: 'p1', durationMs: 600_000 })` (10 min)
- `s2 = makeSession({ projectId: 'p1', durationMs: 1_200_000 })` (20 min)
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- avgSessionDurationMin = round((900000 / 60000) * 10) / 10 = 15
- Assert `store.getEfficiencyStats().avgSessionDurationMin` equals `15`

#### 49. first-turn resolution rate
- `s1 = makeSession({ projectId: 'p1', promptCount: 1 })` (single prompt = first-turn resolution)
- `s2 = makeSession({ projectId: 'p1', promptCount: 3 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- rate = round((1/2) * 1000) / 10 = 50
- Assert `store.getEfficiencyStats().firstTurnResolutionRate` equals `50`

### describe('getWeeklyRecap')

#### 50. sums weekly tokens/cost/sessions
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, totalTokens: 5000, costUsd: 0.5 })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - 2 * ONE_DAY, totalTokens: 3000, costUsd: 0.3 })`
- `store = createPopulatedStore([makeProject({ id: 'p1', name: 'MyProj' })], { p1: [s1, s2] })`
- `const recap = store.getWeeklyRecap()`
- Assert `recap.sessions` equals `2`
- Assert `recap.tokens` equals `8000`
- Assert `recap.costUsd` is approximately `0.8`

#### 51. finds top project
- `p1 = makeProject({ id: 'p1', name: 'Small' })`
- `p2 = makeProject({ id: 'p2', name: 'Big' })`
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, totalTokens: 1000 })`
- `s2 = makeSession({ projectId: 'p2', startTime: NOW - ONE_HOUR, totalTokens: 5000 })`
- `store = createPopulatedStore([p1, p2], { p1: [s1], p2: [s2] })`
- Assert `store.getWeeklyRecap().topProject` equals `'Big'`

### describe('getRecentFileChanges')

#### 52. returns changes within days
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, filesModified: ['/src/a.ts'], filesCreated: [] })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - 10 * ONE_DAY, filesModified: ['/src/b.ts'], filesCreated: [] })`
- `store = createPopulatedStore([makeProject({ id: 'p1', name: 'Proj' })], { p1: [s1, s2] })`
- `const changes = store.getRecentFileChanges(7)`
- Assert `changes.length` equals `1` (only s1's file, s2 is > 7 days ago)

#### 53. sorts newest first
- `s1 = makeSession({ projectId: 'p1', startTime: NOW - 2 * ONE_HOUR, filesModified: ['/src/old.ts'], filesCreated: [] })`
- `s2 = makeSession({ projectId: 'p1', startTime: NOW - ONE_HOUR, filesModified: ['/src/new.ts'], filesCreated: [] })`
- `store = createPopulatedStore([makeProject({ id: 'p1', name: 'Proj' })], { p1: [s1, s2] })`
- `const changes = store.getRecentFileChanges(7)`
- Assert `changes[0].fullPath` equals `'/src/new.ts'`

### describe('getProjectStats')

#### 54. returns all sub-objects
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [makeSession({ projectId: 'p1' })] })`
- `const stats = store.getProjectStats('p1')`
- Assert `stats` has properties: `usageOverTime`, `toolUsage`, `promptPatterns`, `efficiency`, `recentToolCalls`, `weeklyStats`
- Assert `stats.usageOverTime` is an array
- Assert `stats.promptPatterns` is an array of length `6` (the 6 categories)

### describe('getProjectFiles')

#### 55. aggregates files with edit counts
- `s1 = makeSession({ projectId: 'p1', filesModified: ['/src/a.ts', '/src/b.ts'], filesCreated: [] })`
- `s2 = makeSession({ projectId: 'p1', filesModified: ['/src/a.ts'], filesCreated: [] })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- `const files = store.getProjectFiles('p1')`
- Find `/src/a.ts` and assert `editCount` is `2`

#### 56. detects created vs modified vs both
- `s1 = makeSession({ projectId: 'p1', filesModified: ['/src/new.ts', '/src/existing.ts'], filesCreated: ['/src/new.ts'] })`
- `s2 = makeSession({ projectId: 'p1', filesModified: ['/src/new.ts'], filesCreated: [] })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- `const files = store.getProjectFiles('p1')`
- Find `/src/new.ts` and assert `type` is `'both'` (created in s1, modified in s2)
- Find `/src/existing.ts` and assert `type` is `'modified'`

### describe('getProductivityByHour')

#### 57. returns 24 entries
- `store = createPopulatedStore([], {})`
- Assert `store.getProductivityByHour().length` equals `24`

#### 58. calculates per-hour averages
- Create 2 sessions both starting at the same hour:
  - `s1 = makeSession({ projectId: 'p1', startTime: NOW, toolCallCount: 10, filesModified: ['/a.ts', '/b.ts'] })`
  - `s2 = makeSession({ projectId: 'p1', startTime: NOW, toolCallCount: 20, filesModified: ['/c.ts'] })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1, s2] })`
- `const hours = store.getProductivityByHour()`
- Find the hour matching `new Date(NOW).getHours()`
- Assert `avgToolCalls` equals `15` (round((30/2)*10)/10)
- Assert `sessionCount` equals `2`

### describe('handleLiveEvent')

#### 59. marks session inactive on session_stop
- `session = makeSession({ id: 'sess1', projectId: 'p1', isActiveSession: true })`
- `store = createPopulatedStore([makeProject({ id: 'p1', isActive: true })], { p1: [session] })`
- `store.handleLiveEvent({ type: 'session_stop', sessionId: 'sess1', timestamp: NOW })`
- Assert `store.getSessions('p1')[0].isActiveSession` is `false`
- Assert `store.getProject('p1')!.isActive` is `false`

#### 60. emits liveEvent
- `store = createPopulatedStore([], {})`
- Set up a listener: `const events: LiveEvent[] = []; store.on('liveEvent', (e) => events.push(e));`
- `store.handleLiveEvent({ type: 'tool_use', tool: 'Read', timestamp: NOW })`
- Assert `events.length` equals `1`
- Assert `events[0].type` equals `'tool_use'`

#### 61. triggers debounced updated
- `store = createPopulatedStore([], {})`
- Set up a listener: `let updated = false; store.on('updated', () => { updated = true; });`
- `store.handleLiveEvent({ type: 'tool_use', tool: 'Read', timestamp: NOW })`
- Advance timers by 300ms: `vi.advanceTimersByTime(300)`
- Assert `updated` is `true`

### describe('onFileChanged')

#### 62. reloads specific project
- Mock filesystem calls that `loadProject` needs:
  - `fs.existsSync` returns true
  - `fs.readdirSync` returns file entries
  - `fs.readFileSync` returns valid JSONL
  - `fs.statSync` returns mtime
- `store = new DashboardStore('/tmp/claude')`
- Call `await store.onFileChanged('/tmp/claude/projects/test-proj/session1.jsonl')`
- Verify `fs.readdirSync` was called (project reload attempted)

### describe('detectTechStack')

NOTE: detectTechStack is private. Test it indirectly through the public API, or access it via `(store as any).detectTechStack(path)`. Since we need to mock fs, test via the store's internal method.

#### 63. detects Node.js from package.json
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `(fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['package.json'])`
- `store = new DashboardStore('/tmp/claude')`
- Assert `(store as any).detectTechStack('/some/project')` includes `'Node.js'`

#### 64. detects TypeScript from tsconfig.json
- Mock readdirSync to return `['tsconfig.json']`
- Assert result includes `'TypeScript'`

#### 65. detects Python from pyproject.toml
- Mock readdirSync to return `['pyproject.toml']`
- Assert result includes `'Python'`

### describe('getProjectConfig')

#### 66. returns empty config for unknown project
- `store = createPopulatedStore([], {})`
- `const config = store.getProjectConfig('unknown')`
- Assert `config.claudeMd` is `null`
- Assert `config.mcpServers` deep equals `{}`
- Assert `config.projectSettings` deep equals `{}`
- Assert `config.commands` deep equals `[]`

#### 67. merges MCP servers from all sources
- Create a project and populate the store
- Mock the settingsParser methods to return MCP servers from different sources:
  - Global: `{ mcpServers: { globalServer: { command: 'global' } } }`
  - User: `{ mcpServers: { userServer: { command: 'user' } } }`
  - Project settings: `{ mcpServers: { projectServer: { command: 'project' } } }`
  - Project .mcp.json: `{ mcpServers: { mcpJsonServer: { command: 'mcpjson' } } }`
- Access settingsParser: `(store as any).settingsParser`
- Spy on each method and mock return values
- Assert all 4 servers appear in the merged result
- Assert project .mcp.json server overrides same-named global server (if names clash)

### describe('getAllPrompts')

#### 68. returns all user prompts sorted newest first
- Create sessions with user turns at different timestamps:
  - `t1 = makeTurn({ role: 'user', content: 'Old prompt', timestamp: NOW - ONE_DAY })`
  - `t2 = makeTurn({ role: 'user', content: 'New prompt', timestamp: NOW })`
  - `t3 = makeTurn({ role: 'assistant', content: 'Response', timestamp: NOW })` (should be excluded)
- `store = createPopulatedStore([makeProject({ id: 'p1', name: 'Proj' })], { p1: [makeSession({ projectId: 'p1', turns: [t1, t2, t3] })] })`
- `const prompts = store.getAllPrompts()`
- Assert `prompts.length` equals `2` (assistant turn excluded)
- Assert `prompts[0].turn.content` equals `'New prompt'` (newest first)

### describe('getMonthlyUsage') (bonus, testing via getMonthlyTokens)

#### 69. returns monthly token total
- `s1 = makeSession({ projectId: 'p1', startTime: NOW, totalTokens: 5000, costUsd: 0.5 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- Assert `store.getMonthlyTokens()` equals `5000`

#### 70. getMonthlyUsage includes subagent costs
- `s1 = makeSession({ projectId: 'p1', startTime: NOW, totalTokens: 5000, costUsd: 0.5, subagentCostUsd: 0.1 })`
- `store = createPopulatedStore([makeProject({ id: 'p1' })], { p1: [s1] })`
- `const usage = (store as any).getMonthlyUsage()`
- Assert `usage.costUsd` is approximately `0.6` (0.5 session + 0.1 subagent)

## Validation Criteria
- All 70 tests pass
- Uses `vi.useFakeTimers()` and `vi.setSystemTime()` for deterministic date-based tests
- No real filesystem access (fs and os are fully mocked)
- Uses `createPopulatedStore` helper to inject data directly (bypasses scanProjects)
- Uses `toBeCloseTo` for floating-point cost/percentage assertions
- Each test is independent (beforeEach resets mocks and timers)
