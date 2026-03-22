# Spec 26: ActiveSessionCard Unit Tests

## Test File Path
`webview-ui/src/components/__tests__/ActiveSessionCard.test.tsx`

## Source Under Test
`webview-ui/src/components/ActiveSessionCard.tsx`

## Setup

### Imports
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActiveSessionCard from '../ActiveSessionCard';
```

### Sample Data
```typescript
const mockProject = {
  id: 'proj-001',
  name: 'my-cool-project',
  path: '/home/user/projects/my-cool-project',
  lastActive: Date.now(),
  isActive: true,
  sessionCount: 5,
  totalTokens: 50000,
  totalCostUsd: 1.25,
  techStack: ['TypeScript', 'React'],
};
```

Note: The webview-ui vitest config uses `jsdom` environment and has `@testing-library/jest-dom/vitest` registered in its setup file at `webview-ui/src/__tests__/setup.ts`.

---

## Test Cases

### Test 1: renders project name

**Description**: The component should display the project name from the provided project prop.

**Steps**:
1. Render `<ActiveSessionCard project={mockProject} />`.
2. Query for text content matching the project name.

**Assertions**:
- `screen.getByText('my-cool-project')` is in the document.

---

### Test 2: shows green pulse indicator

**Description**: The component renders a green pulsing dot (the "live" indicator) using the classes `bg-green-400` and `animate-pulse`.

**Steps**:
1. Render `<ActiveSessionCard project={mockProject} />`.
2. Find the pulse indicator element. The component renders a `<span>` with classes `w-2 h-2 rounded-full bg-green-400 animate-pulse`.

**Assertions**:
- Query the container for an element with class `animate-pulse`. Use `container.querySelector('.animate-pulse')`.
- That element should not be null.
- That element should have class `bg-green-400`.

---

## Validation Criteria
- All 2 tests pass with `npx vitest run src/components/__tests__/ActiveSessionCard.test.tsx` from the `webview-ui` directory.
- Uses `@testing-library/react` for rendering.
- No mocking needed beyond what the global setup provides.
