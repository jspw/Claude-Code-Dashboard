# Spec 18: App Component Tests

## Test File
**Path**: `webview-ui/src/__tests__/App.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/App.tsx`

## Imports

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
```

## Mock Setup

### 1. Mock recharts (to avoid SVG rendering issues in jsdom)

Place this **before** any component imports:

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

### 2. Mock child view components

To isolate App logic from child rendering complexity, mock the three views:

```tsx
vi.mock('../views/Dashboard', () => ({
  default: (props: any) => (
    <div data-testid="dashboard-view" data-projects={JSON.stringify(props.projects)} data-stats={JSON.stringify(props.stats)}>
      Dashboard View
    </div>
  ),
}));

vi.mock('../views/Sidebar', () => ({
  default: (props: any) => (
    <div data-testid="sidebar-view" data-projects={JSON.stringify(props.projects)} data-stats={JSON.stringify(props.stats)}>
      Sidebar View
    </div>
  ),
}));

vi.mock('../views/ProjectDetail', () => ({
  default: (props: any) => (
    <div data-testid="project-view" data-project={JSON.stringify(props.project)} data-sessions={JSON.stringify(props.sessions)}>
      Project Detail View
    </div>
  ),
}));
```

### 3. Window globals

The setup file (`src/__tests__/setup.ts`) already defines `window.__INITIAL_VIEW__` and `window.__INITIAL_DATA__` as writable. Override them per test:

```tsx
beforeEach(() => {
  (window as any).__INITIAL_VIEW__ = 'dashboard';
  (window as any).__INITIAL_DATA__ = {
    projects: [],
    stats: { totalProjects: 0, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 },
  };
});
```

## Sample Data

```tsx
const sampleStats = {
  totalProjects: 5,
  activeSessionCount: 2,
  tokensTodayTotal: 10000,
  costTodayUsd: 0.5,
  tokensWeekTotal: 50000,
  costWeekUsd: 2.5,
};

const sampleProjects = [
  { id: 'p1', name: 'Project Alpha', path: '/path/alpha', lastActive: Date.now(), isActive: true, sessionCount: 3, totalTokens: 5000, totalCostUsd: 0.25, techStack: ['TypeScript'] },
  { id: 'p2', name: 'Project Beta', path: '/path/beta', lastActive: Date.now() - 86400000, isActive: false, sessionCount: 1, totalTokens: 2000, totalCostUsd: 0.1, techStack: ['Python'] },
];

const sampleSessions = [
  {
    id: 's1', projectId: 'p1', parentSessionId: null, cwd: '/path/alpha', isActiveSession: false,
    startTime: Date.now() - 3600000, endTime: Date.now(), durationMs: 3600000,
    inputTokens: 1000, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 500,
    totalTokens: 1500, costUsd: 0.05, promptCount: 5, toolCallCount: 10,
    filesModified: [], filesCreated: [], turns: [], sessionSummary: 'Test session',
    hasThinking: false, thinkingTokens: 0, cacheHitRate: 0,
    subagentCostUsd: 0, idleTimeMs: null, activeTimeMs: null, activityRatio: null,
  },
];
```

## Test Cases

### Test 1: renders Dashboard view by default
**Description**: With `__INITIAL_VIEW__` set to `'dashboard'` (the default), the App should render the Dashboard view component.

```tsx
it('renders Dashboard view by default', () => {
  render(<App />);
  expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
  expect(screen.getByText('Dashboard View')).toBeInTheDocument();
});
```

**Assertions**:
- Element with `data-testid="dashboard-view"` is in the document.

### Test 2: renders Sidebar when view='sidebar'
**Description**: When `__INITIAL_VIEW__` is `'sidebar'`, render the Sidebar component.

```tsx
it("renders Sidebar when view='sidebar'", () => {
  (window as any).__INITIAL_VIEW__ = 'sidebar';
  (window as any).__INITIAL_DATA__ = { projects: [], stats: sampleStats };
  render(<App />);
  expect(screen.getByTestId('sidebar-view')).toBeInTheDocument();
});
```

**Assertions**:
- Element with `data-testid="sidebar-view"` is in the document.

### Test 3: renders ProjectDetail when view='project'
**Description**: When `__INITIAL_VIEW__` is `'project'`, render the ProjectDetail component.

```tsx
it("renders ProjectDetail when view='project'", () => {
  (window as any).__INITIAL_VIEW__ = 'project';
  (window as any).__INITIAL_DATA__ = { project: sampleProjects[0], sessions: sampleSessions };
  render(<App />);
  expect(screen.getByTestId('project-view')).toBeInTheDocument();
});
```

**Assertions**:
- Element with `data-testid="project-view"` is in the document.

### Test 4: updates state on stateUpdate message
**Description**: When a `stateUpdate` message is posted to the window, App should merge the payload into state. This means props passed to Dashboard should update.

```tsx
it('updates state on stateUpdate message', () => {
  (window as any).__INITIAL_DATA__ = { projects: [], stats: sampleStats };
  render(<App />);

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'stateUpdate', payload: { projects: sampleProjects } },
      })
    );
  });

  const dashboardEl = screen.getByTestId('dashboard-view');
  const projects = JSON.parse(dashboardEl.getAttribute('data-projects')!);
  expect(projects).toHaveLength(2);
  expect(projects[0].name).toBe('Project Alpha');
});
```

**Assertions**:
- After the message, the Dashboard receives the updated projects array.

### Test 5: updates state on liveEvent message
**Description**: A `liveEvent` message should also merge payload into state, same as `stateUpdate`.

```tsx
it('updates state on liveEvent message', () => {
  (window as any).__INITIAL_DATA__ = { projects: [], stats: sampleStats };
  render(<App />);

  const updatedStats = { ...sampleStats, activeSessionCount: 5 };
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'liveEvent', payload: { stats: updatedStats } },
      })
    );
  });

  const dashboardEl = screen.getByTestId('dashboard-view');
  const stats = JSON.parse(dashboardEl.getAttribute('data-stats')!);
  expect(stats.activeSessionCount).toBe(5);
});
```

**Assertions**:
- After the liveEvent message, Dashboard receives the updated stats.

### Test 6: passes projects/stats to Sidebar
**Description**: When in sidebar view, the App should pass `projects` and `stats` props to the Sidebar component.

```tsx
it('passes projects/stats to Sidebar', () => {
  (window as any).__INITIAL_VIEW__ = 'sidebar';
  (window as any).__INITIAL_DATA__ = { projects: sampleProjects, stats: sampleStats };
  render(<App />);

  const sidebarEl = screen.getByTestId('sidebar-view');
  const projects = JSON.parse(sidebarEl.getAttribute('data-projects')!);
  const stats = JSON.parse(sidebarEl.getAttribute('data-stats')!);
  expect(projects).toHaveLength(2);
  expect(stats.totalProjects).toBe(5);
});
```

**Assertions**:
- Sidebar receives the correct projects array and stats object.

### Test 7: passes project/sessions to ProjectDetail
**Description**: When in project view, the App should pass `project` and `sessions` props to ProjectDetail.

```tsx
it('passes project/sessions to ProjectDetail', () => {
  (window as any).__INITIAL_VIEW__ = 'project';
  (window as any).__INITIAL_DATA__ = { project: sampleProjects[0], sessions: sampleSessions };
  render(<App />);

  const projectEl = screen.getByTestId('project-view');
  const project = JSON.parse(projectEl.getAttribute('data-project')!);
  const sessions = JSON.parse(projectEl.getAttribute('data-sessions')!);
  expect(project.name).toBe('Project Alpha');
  expect(sessions).toHaveLength(1);
});
```

**Assertions**:
- ProjectDetail receives the correct project and sessions data.

## Validation Criteria
- All 7 tests pass with `npx vitest run src/__tests__/App.test.tsx` from the `webview-ui/` directory.
- Mocking the three child views keeps each test focused on App's routing/state logic.
- The setup file handles `acquireVsCodeApi` and `ResizeObserver` automatically.
