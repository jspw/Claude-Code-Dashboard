# Test Spec: format utilities

## Target File
`webview-ui/src/utils/__tests__/format.test.ts`

## Source Under Test
`webview-ui/src/utils/format.ts`

## Imports

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatTokens, formatDuration, timeAgo } from '../format';
```

## Setup

No global setup needed. For `timeAgo` tests, use `vi.spyOn(Date, 'now')` and restore after each test.

```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Test Cases (15 total)

### describe('formatTokens')

#### 1. formats 0 as "0"
- `expect(formatTokens(0)).toBe('0')`

#### 2. formats 500 as "500"
- `expect(formatTokens(500)).toBe('500')`

#### 3. formats 1000 as "1.0k"
- `expect(formatTokens(1000)).toBe('1.0k')`

#### 4. formats 1500 as "1.5k"
- `expect(formatTokens(1500)).toBe('1.5k')`

#### 5. formats 1000000 as "1.0M"
- `expect(formatTokens(1_000_000)).toBe('1.0M')`

#### 6. formats 2500000 as "2.5M"
- `expect(formatTokens(2_500_000)).toBe('2.5M')`

### describe('formatDuration')

#### 7. returns em-dash for null
- `expect(formatDuration(null)).toBe('\u2014')` (em-dash character)

#### 8. returns em-dash for 0
- `expect(formatDuration(0)).toBe('\u2014')`

#### 9. formats 5000ms as "5s"
- `expect(formatDuration(5000)).toBe('5s')`

#### 10. formats 90000ms as "1m 30s"
- `expect(formatDuration(90_000)).toBe('1m 30s')`

#### 11. formats 3700000ms as "1h 1m"
- `expect(formatDuration(3_700_000)).toBe('1h 1m')`

### describe('timeAgo')

#### 12. returns "never" for 0
- `expect(timeAgo(0)).toBe('never')`

#### 13. returns "just now" for timestamp 30min ago
- `vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)`
- `expect(timeAgo(1_000_000_000 - 30 * 60 * 1000)).toBe('just now')`
- (30 min = 1_800_000ms, which is < 1 hour)

#### 14. returns hours ago for 5h
- `vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)`
- `expect(timeAgo(1_000_000_000 - 5 * 3_600_000)).toBe('5h ago')`

#### 15. returns days ago for 3d
- `vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)`
- `expect(timeAgo(1_000_000_000 - 3 * 86_400_000)).toBe('3d ago')`

## Source Reference

```typescript
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatDuration(ms: number | null): string {
  if (!ms) return '\u2014'; // em-dash
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
```

## Validation Criteria
- All 15 tests pass
- No mocking needed except `Date.now` for `timeAgo`
- Pure function tests: no side effects, no async
- Use exact string equality (`toBe`) for all assertions
