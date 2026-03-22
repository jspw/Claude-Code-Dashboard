# Spec 29: ActivityFeed Unit Tests

## Test File Path
`webview-ui/src/components/__tests__/ActivityFeed.test.tsx`

## Source Under Test
`webview-ui/src/components/ActivityFeed.tsx`

## Setup

### Imports
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityFeed from '../ActivityFeed';
```

### Sample Data
```typescript
const mockItems = [
  {
    id: 'act-1',
    type: 'tool_use',
    description: 'Used Read tool on src/index.ts',
    timestamp: 1700000000000,
  },
  {
    id: 'act-2',
    type: 'session_stop',
    description: 'Session ended for project-alpha',
    timestamp: 1700000060000,
  },
  {
    id: 'act-3',
    type: 'notification',
    description: 'Build completed successfully',
    timestamp: 1700000120000,
  },
];
```

Note: Uses `jsdom` environment with `@testing-library/jest-dom/vitest` from the webview-ui setup.

---

## Test Cases

### Test 1: renders all activity items

**Description**: All items passed via the `items` prop are rendered in the feed.

**Steps**:
1. Render `<ActivityFeed items={mockItems} />`.

**Assertions**:
- `screen.getByText('Used Read tool on src/index.ts')` is in the document.
- `screen.getByText('Session ended for project-alpha')` is in the document.
- `screen.getByText('Build completed successfully')` is in the document.

---

### Test 2: shows timestamp

**Description**: Each activity item displays a formatted time string derived from `new Date(item.timestamp).toLocaleTimeString()`.

**Steps**:
1. Render `<ActivityFeed items={[mockItems[0]]} />` (single item for simpler assertion).
2. The component renders `new Date(item.timestamp).toLocaleTimeString()`. Compute the expected string: `new Date(1700000000000).toLocaleTimeString()`.

**Assertions**:
- `screen.getByText(new Date(1700000000000).toLocaleTimeString())` is in the document.

Note: `toLocaleTimeString()` output depends on the test environment locale. Use the same call to compute the expected value dynamically rather than hardcoding a specific format.

---

### Test 3: shows description

**Description**: Each item's `description` field is rendered as visible text.

**Steps**:
1. Render `<ActivityFeed items={mockItems} />`.

**Assertions**:
- For each mock item, `screen.getByText(item.description)` is in the document.

---

## Validation Criteria
- All 3 tests pass with `npx vitest run src/components/__tests__/ActivityFeed.test.tsx` from the `webview-ui` directory.
- Uses `@testing-library/react` for rendering.
- No mocking needed beyond what the global setup provides.
