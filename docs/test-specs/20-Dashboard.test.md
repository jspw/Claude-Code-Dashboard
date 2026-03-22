# Spec 20: Dashboard Component Tests

## Test File
**Path**: `webview-ui/src/views/__tests__/Dashboard.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/views/Dashboard.tsx`

## Imports

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';
import { Project, DashboardStats, BudgetStatus } from '../../types';
```

## Mock Setup

### 1. Mock recharts

```tsx
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  Area: () => null,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
}));
```

### 2. Mock vscode bridge

```tsx
const mockPostMessage = vi.fn();
vi.mock('../../vscode', () => ({
  vscode: { postMessage: mockPostMessage },
}));
```

### 3. Mock child chart/component modules that Dashboard imports

To avoid rendering issues with child components that also use recharts or complex rendering:

```tsx
vi.mock('../../components/UsageLineChart', () => ({ default: () => <div data-testid="usage-line-chart" /> }));
vi.mock('../../components/ProjectBarChart', () => ({ default: () => <div data-testid="project-bar-chart" /> }));
vi.mock('../../components/HeatmapGrid', () => ({ default: () => <div data-testid="heatmap-grid" /> }));
vi.mock('../../components/PatternChart', () => ({ default: () => <div data-testid="pattern-chart" /> }));
vi.mock('../../components/ToolUsageBar', () => ({ default: () => <div data-testid="tool-usage-bar" /> }));
vi.mock('../../components/HotFilesList', () => ({ default: () => <div data-testid="hot-files-list" /> }));
vi.mock('../../components/EfficiencyCards', () => ({ default: () => <div data-testid="efficiency-cards" /> }));
vi.mock('../../components/RecentChanges', () => ({ default: () => <div data-testid="recent-changes" /> }));
vi.mock('../../components/ProductivityChart', () => ({ default: () => <div data-testid="productivity-chart" /> }));
```

## Sample Data

```tsx
const baseStats: DashboardStats = {
  totalProjects: 5,
  activeSessionCount: 2,
  tokensTodayTotal: 25000,
  costTodayUsd: 1.234,
  tokensWeekTotal: 150000,
  costWeekUsd: 7.89,
};

const now = Date.now();

const activeProject: Project = {
  id: 'p1',
  name: 'Alpha Project',
  path: '/path/alpha',
  lastActive: now,
  isActive: true,
  sessionCount: 5,
  totalTokens: 10000,
  totalCostUsd: 0.5,
  techStack: ['TypeScript'],
};

const inactiveProject1: Project = {
  id: 'p2',
  name: 'Beta Project',
  path: '/path/beta',
  lastActive: now - 86_400_000,
  isActive: false,
  sessionCount: 3,
  totalTokens: 8000,
  totalCostUsd: 0.4,
  techStack: ['Python'],
};

const inactiveProject2: Project = {
  id: 'p3',
  name: 'Gamma Project',
  path: '/path/gamma',
  lastActive: now - 2 * 86_400_000,
  isActive: false,
  sessionCount: 10,
  totalTokens: 50000,
  totalCostUsd: 2.5,
  techStack: ['Rust'],
};

const budgetWarning: BudgetStatus = {
  budgetUsd: 10.0,
  spentUsd: 8.5,
  pct: 0.85,
};

const budgetExceeded: BudgetStatus = {
  budgetUsd: 10.0,
  spentUsd: 12.0,
  pct: 1.2,
};
```

## Test Cases

### Test 1: renders title "Claude Code Dashboard"
**Description**: The main heading should be rendered.

```tsx
it('renders title "Claude Code Dashboard"', () => {
  render(<Dashboard projects={[]} stats={baseStats} />);
  expect(screen.getByText('Claude Code Dashboard')).toBeInTheDocument();
});
```

**Assertions**:
- Heading "Claude Code Dashboard" is in the document.

### Test 2: renders stats cards (tokens today, cost today, etc.)
**Description**: Four stat cards should be rendered on the Overview tab (the default): "Tokens today", "Cost today", "Tokens this week", "Cost this week".

```tsx
it('renders stats cards', () => {
  render(<Dashboard projects={[]} stats={baseStats} />);
  expect(screen.getByText('Tokens today')).toBeInTheDocument();
  expect(screen.getByText('25.0k')).toBeInTheDocument(); // formatTokens(25000)
  expect(screen.getByText('Cost today')).toBeInTheDocument();
  expect(screen.getByText('$1.234')).toBeInTheDocument();
  expect(screen.getByText('Tokens this week')).toBeInTheDocument();
  expect(screen.getByText('150.0k')).toBeInTheDocument(); // formatTokens(150000)
  expect(screen.getByText('Cost this week')).toBeInTheDocument();
  expect(screen.getByText('$7.89')).toBeInTheDocument();
});
```

**Assertions**:
- All 4 labels and their formatted values are present.

### Test 3: renders tab navigation (Overview, Charts, Insights)
**Description**: Three tab buttons should be visible.

```tsx
it('renders tab navigation', () => {
  render(<Dashboard projects={[]} stats={baseStats} />);
  expect(screen.getByText('Overview')).toBeInTheDocument();
  expect(screen.getByText('Charts')).toBeInTheDocument();
  expect(screen.getByText('Insights')).toBeInTheDocument();
});
```

**Assertions**:
- "Overview", "Charts", "Insights" are all present.

### Test 4: shows active projects with live indicator
**Description**: Active projects appear in the "Active Now" section with the text "live".

```tsx
it('shows active projects with live indicator', () => {
  render(<Dashboard projects={[activeProject, inactiveProject1]} stats={baseStats} />);
  expect(screen.getByText('Active Now')).toBeInTheDocument();
  expect(screen.getByText('Alpha Project')).toBeInTheDocument();
  // Active project card shows "live" text
  expect(screen.getByText('live')).toBeInTheDocument();
});
```

**Assertions**:
- "Active Now" heading is present.
- The active project name is rendered.
- "live" text is visible.

### Test 5: filters projects by name
**Description**: Typing in the filter input should filter the inactive project list by name (case-insensitive).

```tsx
it('filters projects by name', () => {
  render(<Dashboard projects={[activeProject, inactiveProject1, inactiveProject2]} stats={baseStats} />);

  // Both inactive projects should be visible initially
  expect(screen.getByText('Beta Project')).toBeInTheDocument();
  expect(screen.getByText('Gamma Project')).toBeInTheDocument();

  // Type in filter
  const filterInput = screen.getByPlaceholderText('Filter by name…');
  fireEvent.change(filterInput, { target: { value: 'beta' } });

  // Only Beta should remain
  expect(screen.getByText('Beta Project')).toBeInTheDocument();
  expect(screen.queryByText('Gamma Project')).not.toBeInTheDocument();
});
```

**Assertions**:
- Before filtering, both inactive projects are visible.
- After filtering by "beta", only "Beta Project" remains.

### Test 6: sorts projects by different criteria
**Description**: The sort dropdown changes the order of inactive projects. Default is "Last active". Changing to "Cost" sorts by `totalCostUsd` descending. Changing to "Sessions" sorts by `sessionCount` descending.

```tsx
it('sorts projects by different criteria', () => {
  render(<Dashboard projects={[activeProject, inactiveProject1, inactiveProject2]} stats={baseStats} />);

  const sortSelect = screen.getByDisplayValue('Last active');

  // Sort by cost — Gamma (2.5) > Beta (0.4)
  fireEvent.change(sortSelect, { target: { value: 'cost' } });
  const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('Project'));
  // Gamma should come before Beta
  const gammaIdx = buttons.findIndex(b => b.textContent?.includes('Gamma'));
  const betaIdx = buttons.findIndex(b => b.textContent?.includes('Beta'));
  expect(gammaIdx).toBeLessThan(betaIdx);

  // Sort by sessions — Gamma (10) > Beta (3)
  fireEvent.change(sortSelect, { target: { value: 'sessions' } });
  const buttons2 = screen.getAllByRole('button').filter(b => b.textContent?.includes('Project'));
  const gammaIdx2 = buttons2.findIndex(b => b.textContent?.includes('Gamma'));
  const betaIdx2 = buttons2.findIndex(b => b.textContent?.includes('Beta'));
  expect(gammaIdx2).toBeLessThan(betaIdx2);
});
```

**Assertions**:
- When sorted by cost, Gamma (higher cost) appears before Beta.
- When sorted by sessions, Gamma (more sessions) appears before Beta.

### Test 7: shows budget alert banner when budget >= 80%
**Description**: When `budgetStatus` is provided with `pct >= 0.8`, a banner should appear. At 80% it shows "Monthly budget 80% used". At >= 100% it shows "Monthly budget exceeded".

```tsx
it('shows budget alert banner when budget >= 80%', () => {
  const { rerender } = render(
    <Dashboard projects={[]} stats={baseStats} budgetStatus={budgetWarning} />
  );
  expect(screen.getByText('Monthly budget 80% used')).toBeInTheDocument();
  expect(screen.getByText(/\$8\.50 of \$10\.00/)).toBeInTheDocument();

  // Re-render with exceeded budget
  rerender(<Dashboard projects={[]} stats={baseStats} budgetStatus={budgetExceeded} />);
  expect(screen.getByText('Monthly budget exceeded')).toBeInTheDocument();
  expect(screen.getByText(/\$12\.00 of \$10\.00/)).toBeInTheDocument();
});
```

**Assertions**:
- At 85%, the warning text "Monthly budget 80% used" and "$8.50 of $10.00" are shown.
- At 120%, the text "Monthly budget exceeded" and "$12.00 of $10.00" are shown.

## Validation Criteria
- All 7 tests pass with `npx vitest run src/views/__tests__/Dashboard.test.tsx` from the `webview-ui/` directory.
- Mocking child chart components prevents SVG rendering issues.
- The `vscode` mock is available but only needed if testing click handlers (not required for these 7 tests, but included for completeness).
