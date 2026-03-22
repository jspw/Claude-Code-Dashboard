# Spec 19: Sidebar Component Tests

## Test File
**Path**: `webview-ui/src/views/__tests__/Sidebar.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/views/Sidebar.tsx`

## Imports

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from '../Sidebar';
import { Project, DashboardStats } from '../../types';
```

## Mock Setup

Mock the vscode bridge module to capture `postMessage` calls:

```tsx
const mockPostMessage = vi.fn();
vi.mock('../../vscode', () => ({
  vscode: { postMessage: mockPostMessage },
}));

beforeEach(() => {
  mockPostMessage.mockClear();
});
```

## Sample Data

```tsx
const baseStats: DashboardStats = {
  totalProjects: 5,
  activeSessionCount: 2,
  tokensTodayTotal: 15000,
  costTodayUsd: 0.75,
  tokensWeekTotal: 80000,
  costWeekUsd: 4.0,
};

const now = Date.now();

const activeProject: Project = {
  id: 'p1',
  name: 'Active Project',
  path: '/path/active',
  lastActive: now,
  isActive: true,
  sessionCount: 5,
  totalTokens: 10000,
  totalCostUsd: 0.5,
  techStack: ['TypeScript'],
};

const recentProject: Project = {
  id: 'p2',
  name: 'Recent Project',
  path: '/path/recent',
  lastActive: now - 2 * 86_400_000, // 2 days ago (< 7 days)
  isActive: false,
  sessionCount: 3,
  totalTokens: 5000,
  totalCostUsd: 0.25,
  techStack: ['Python'],
};

const olderProject: Project = {
  id: 'p3',
  name: 'Older Project',
  path: '/path/older',
  lastActive: now - 10 * 86_400_000, // 10 days ago (>= 7 days)
  isActive: false,
  sessionCount: 1,
  totalTokens: 1000,
  totalCostUsd: 0.05,
  techStack: [],
};

const duplicateProject: Project = {
  ...activeProject,
  name: 'Active Project Dup', // same id as activeProject, different name — should be deduped
};
```

## Test Cases

### Test 1: renders stats bar with active count and tokens
**Description**: The stats bar at the top shows the active session count and tokens today, using the format from `formatTokens` (e.g., 15000 -> "15.0k").

```tsx
it('renders stats bar with active count and tokens', () => {
  render(<Sidebar projects={[]} stats={baseStats} />);
  // The stats bar renders: "{activeSessionCount} active · {formatTokens(tokensTodayTotal)} tokens today"
  // The middot (·) is rendered as &middot; which is Unicode \u00B7
  expect(screen.getByText(/2 active/)).toBeInTheDocument();
  expect(screen.getByText(/15\.0k tokens today/)).toBeInTheDocument();
});
```

**Assertions**:
- Text containing "2 active" is present.
- Text containing "15.0k tokens today" is present.

### Test 2: renders "View Dashboard" button
**Description**: There should be a button with the text "View Dashboard" that calls `vscode.postMessage({ type: 'openDashboard' })` on click.

```tsx
it('renders "View Dashboard" button', () => {
  render(<Sidebar projects={[]} stats={baseStats} />);
  const btn = screen.getByText('View Dashboard');
  expect(btn).toBeInTheDocument();
  fireEvent.click(btn);
  expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openDashboard' });
});
```

**Assertions**:
- Button with text "View Dashboard" exists.
- Clicking it calls `postMessage` with `{ type: 'openDashboard' }`.

### Test 3: categorizes active projects
**Description**: Projects with `isActive: true` should appear under the "Active" section.

```tsx
it('categorizes active projects', () => {
  render(<Sidebar projects={[activeProject, recentProject]} stats={baseStats} />);
  expect(screen.getByText('Active')).toBeInTheDocument();
  expect(screen.getByText('Active Project')).toBeInTheDocument();
});
```

**Assertions**:
- "Active" section header is present.
- "Active Project" name is rendered.

### Test 4: categorizes recent projects (< 7 days)
**Description**: Non-active projects with `lastActive` within the last 7 days go under "Recent".

```tsx
it('categorizes recent projects (< 7 days)', () => {
  render(<Sidebar projects={[recentProject]} stats={baseStats} />);
  expect(screen.getByText('Recent')).toBeInTheDocument();
  expect(screen.getByText('Recent Project')).toBeInTheDocument();
});
```

**Assertions**:
- "Recent" section header is present.
- "Recent Project" name is rendered.

### Test 5: categorizes older projects (>= 7 days)
**Description**: Non-active projects with `lastActive` >= 7 days ago go under "Older".

```tsx
it('categorizes older projects (>= 7 days)', () => {
  render(<Sidebar projects={[olderProject]} stats={baseStats} />);
  expect(screen.getByText('Older')).toBeInTheDocument();
  expect(screen.getByText('Older Project')).toBeInTheDocument();
});
```

**Assertions**:
- "Older" section header is present.
- "Older Project" name is rendered.

### Test 6: deduplicates projects by id
**Description**: If two projects have the same `id`, only the last one (per `Map` semantics) should appear.

```tsx
it('deduplicates projects by id', () => {
  render(<Sidebar projects={[activeProject, duplicateProject]} stats={baseStats} />);
  // Both have id 'p1', so only one should render
  // Map keeps the last value for a key, so 'Active Project Dup' wins
  const items = screen.getAllByText(/Active Project/);
  expect(items).toHaveLength(1);
  expect(items[0].textContent).toBe('Active Project Dup');
});
```

**Assertions**:
- Only one project element matching "Active Project" is rendered.
- It is the duplicate (last one inserted into the Map).

### Test 7: sends openProject message on click
**Description**: Clicking a project row should call `vscode.postMessage({ type: 'openProject', projectId: <id> })`.

```tsx
it('sends openProject message on click', () => {
  render(<Sidebar projects={[recentProject]} stats={baseStats} />);
  const projectRow = screen.getByText('Recent Project');
  fireEvent.click(projectRow);
  expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'p2' });
});
```

**Assertions**:
- `postMessage` is called with the correct type and projectId.

## Validation Criteria
- All 7 tests pass with `npx vitest run src/views/__tests__/Sidebar.test.tsx` from the `webview-ui/` directory.
- The `vscode` module mock captures all `postMessage` calls for assertion.
- Time-based categorization depends on `Date.now()` — the sample data uses relative timestamps so tests are not flaky.
