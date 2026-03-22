# Spec 28: RecentChanges Unit Tests

## Test File Path
`webview-ui/src/components/__tests__/RecentChanges.test.tsx`

## Source Under Test
`webview-ui/src/components/RecentChanges.tsx`

## Setup

### Imports
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecentChanges from '../RecentChanges';
```

### Sample Data
```typescript
import { RecentFileChange } from '../../types';

// Use a fixed "now" so timeAgo calculations are deterministic
const NOW = 1700000000000;

const mockData: RecentFileChange[] = [
  {
    file: 'App.tsx',
    fullPath: '/home/user/project/src/App.tsx',
    type: 'created',
    project: 'my-project',
    projectId: 'proj-001',
    timestamp: NOW - 120_000, // 2 minutes ago
  },
  {
    file: 'utils.ts',
    fullPath: '/home/user/project/src/utils.ts',
    type: 'modified',
    project: 'my-project',
    projectId: 'proj-001',
    timestamp: NOW - 7_200_000, // 2 hours ago
  },
];
```

### Timer Setup
Use `vi.spyOn(Date, 'now').mockReturnValue(NOW)` in `beforeEach` and restore in `afterEach`:
```typescript
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
});
```

Note: Uses `jsdom` environment with `@testing-library/jest-dom/vitest` from the webview-ui setup.

---

## Test Cases

### Test 1: shows empty message when no data

**Description**: When `data` is an empty array, the component renders the empty state.

**Steps**:
1. Render `<RecentChanges data={[]} />`.

**Assertions**:
- `screen.getByText('No recent file changes.')` is in the document.

---

### Test 2: renders file changes with type badges (created/modified)

**Description**: Each file change shows a badge indicating whether it was "created" or "modified", with appropriate styling.

**Steps**:
1. Render `<RecentChanges data={mockData} />`.

**Assertions**:
- `screen.getByText('created')` is in the document.
- `screen.getByText('modified')` is in the document.
- The "created" badge element should have classes containing `bg-green-500/20` and `text-green-400`.
- The "modified" badge element should have classes containing `bg-blue-500/20` and `text-blue-400`.

To check classes:
```typescript
const createdBadge = screen.getByText('created');
expect(createdBadge.className).toContain('bg-green-500/20');
expect(createdBadge.className).toContain('text-green-400');

const modifiedBadge = screen.getByText('modified');
expect(modifiedBadge.className).toContain('bg-blue-500/20');
expect(modifiedBadge.className).toContain('text-blue-400');
```

---

### Test 3: shows project name and time ago

**Description**: Each row shows the project name and a human-readable time-ago string.

**Steps**:
1. Render `<RecentChanges data={mockData} />`.

**Assertions**:
- `screen.getAllByText('my-project')` has length 2 (one per entry).
- `screen.getByText('2m ago')` is in the document (for the item 2 minutes ago).
- `screen.getByText('2h ago')` is in the document (for the item 2 hours ago).

---

## Validation Criteria
- All 3 tests pass with `npx vitest run src/components/__tests__/RecentChanges.test.tsx` from the `webview-ui` directory.
- Uses `@testing-library/react` for rendering.
- `Date.now()` is mocked to ensure deterministic time-ago values.
