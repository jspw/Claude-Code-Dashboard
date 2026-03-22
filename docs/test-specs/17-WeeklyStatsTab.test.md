# Spec 17: WeeklyStatsTab Component Tests

## Test File
**Path**: `webview-ui/src/components/__tests__/WeeklyStatsTab.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/components/WeeklyStatsTab.tsx`

## Imports

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeeklyStatsTab from '../WeeklyStatsTab';
import { ProjectStats } from '../../types';
```

## Mock Setup

Recharts uses SVG elements that fail in jsdom. Mock all recharts components used by this file at the top of the test file, **before** any imports of the component:

```tsx
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));
```

Place this `vi.mock(...)` call **before** the `import WeeklyStatsTab` statement. Vitest hoists `vi.mock` calls automatically.

## Sample Data

```tsx
const sampleProjectStats: ProjectStats = {
  usageOverTime: [],
  toolUsage: [],
  promptPatterns: [],
  efficiency: {
    avgTokensPerPrompt: 0,
    avgToolCallsPerSession: 0,
    avgSessionDurationMin: 0,
    firstTurnResolutionRate: 0,
    avgActiveRatio: 0,
  },
  recentToolCalls: [],
  weeklyStats: {
    sessions: 12,
    tokens: 45000,
    costUsd: 1.234,
    dailyBreakdown: [
      { date: 'Mon', tokens: 10000, costUsd: 0.3, sessions: 3 },
      { date: 'Tue', tokens: 15000, costUsd: 0.4, sessions: 4 },
      { date: 'Wed', tokens: 20000, costUsd: 0.534, sessions: 5 },
    ],
  },
};

const zeroTokenStats: ProjectStats = {
  ...sampleProjectStats,
  weeklyStats: {
    sessions: 0,
    tokens: 0,
    costUsd: 0,
    dailyBreakdown: [
      { date: 'Mon', tokens: 0, costUsd: 0, sessions: 0 },
      { date: 'Tue', tokens: 0, costUsd: 0, sessions: 0 },
    ],
  },
};
```

## Test Cases

### Test 1: shows "No data available" when no projectStats
**Description**: When `projectStats` is `undefined`, the component should show a fallback message.

```tsx
it('shows "No data available" when no projectStats', () => {
  render(<WeeklyStatsTab />);
  expect(screen.getByText(/No data available/)).toBeInTheDocument();
});
```

**Assertions**:
- Text matching "No data available" is in the document.

### Test 2: renders 3 stat cards (sessions, tokens, cost)
**Description**: With valid data, the component renders three `StatCard` elements showing sessions, tokens, and cost.

```tsx
it('renders 3 stat cards', () => {
  render(<WeeklyStatsTab projectStats={sampleProjectStats} />);
  expect(screen.getByText('Sessions this week')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('Tokens this week')).toBeInTheDocument();
  expect(screen.getByText('45.0k')).toBeInTheDocument(); // formatTokens(45000) = "45.0k"
  expect(screen.getByText('Cost this week')).toBeInTheDocument();
  expect(screen.getByText('$1.234')).toBeInTheDocument();
});
```

**Assertions**:
- Labels "Sessions this week", "Tokens this week", "Cost this week" are present.
- Values "12", "45.0k", "$1.234" are present.

### Test 3: shows daily breakdown rows
**Description**: The "Day-by-Day" section renders rows for each day in `dailyBreakdown` (reversed order). Each row shows the date, session count, token count, and cost.

```tsx
it('shows daily breakdown rows', () => {
  render(<WeeklyStatsTab projectStats={sampleProjectStats} />);
  expect(screen.getByText('Day-by-Day')).toBeInTheDocument();
  // dailyBreakdown is reversed, so Wed appears first
  expect(screen.getByText('Wed')).toBeInTheDocument();
  expect(screen.getByText('Tue')).toBeInTheDocument();
  expect(screen.getByText('Mon')).toBeInTheDocument();
  // Check session counts — format is "N session" or "N sessions"
  expect(screen.getByText('3 sessions')).toBeInTheDocument();
  expect(screen.getByText('4 sessions')).toBeInTheDocument();
  expect(screen.getByText('5 sessions')).toBeInTheDocument();
});
```

**Assertions**:
- "Day-by-Day" heading is present.
- All three day labels are rendered.
- Session count text for each day is present.

### Test 4: shows "No activity" message when tokens=0
**Description**: When `tokens` is 0 (no activity), the component should display "No activity in the last 7 days." instead of the chart.

```tsx
it('shows "No activity" message when tokens=0', () => {
  render(<WeeklyStatsTab projectStats={zeroTokenStats} />);
  expect(screen.getByText(/No activity in the last 7 days/)).toBeInTheDocument();
});
```

**Assertions**:
- Text matching "No activity in the last 7 days" is in the document.

## Validation Criteria
- All 4 tests pass with `npx vitest run src/components/__tests__/WeeklyStatsTab.test.tsx` from the `webview-ui/` directory.
- The recharts mock prevents SVG rendering errors in jsdom.
- `formatTokens` is imported internally by the component from `../../utils/format` — it does not need to be mocked.
