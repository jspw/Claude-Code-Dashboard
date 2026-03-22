# Spec 27: HotFilesList Unit Tests

## Test File Path
`webview-ui/src/components/__tests__/HotFilesList.test.tsx`

## Source Under Test
`webview-ui/src/components/HotFilesList.tsx`

## Setup

### Imports
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HotFilesList from '../HotFilesList';
```

### Sample Data
```typescript
import { HotFile } from '../../types';

const mockData: HotFile[] = [
  {
    file: 'index.ts',
    fullPath: '/home/user/project/src/index.ts',
    editCount: 15,
    projects: ['project-alpha', 'project-beta'],
  },
  {
    file: 'utils.ts',
    fullPath: '/home/user/project/src/utils.ts',
    editCount: 8,
    projects: ['project-alpha'],
  },
];
```

Note: Uses `jsdom` environment with `@testing-library/jest-dom/vitest` from the webview-ui setup.

---

## Test Cases

### Test 1: shows empty message when data is empty

**Description**: When `data` is an empty array, the component renders the empty state message.

**Steps**:
1. Render `<HotFilesList data={[]} />`.

**Assertions**:
- `screen.getByText('No file edit data yet.')` is in the document.

---

### Test 2: renders file names

**Description**: Each hot file's name is displayed.

**Steps**:
1. Render `<HotFilesList data={mockData} />`.

**Assertions**:
- `screen.getByText('index.ts')` is in the document.
- `screen.getByText('utils.ts')` is in the document.

---

### Test 3: shows edit count badge

**Description**: Each file entry displays its edit count in a badge.

**Steps**:
1. Render `<HotFilesList data={mockData} />`.

**Assertions**:
- `screen.getByText('15')` is in the document.
- `screen.getByText('8')` is in the document.

---

### Test 4: shows project badges

**Description**: Each file entry displays badge elements for each project it belongs to.

**Steps**:
1. Render `<HotFilesList data={mockData} />`.

**Assertions**:
- `screen.getAllByText('project-alpha')` has length 2 (appears for both files).
- `screen.getByText('project-beta')` is in the document.

---

## Validation Criteria
- All 4 tests pass with `npx vitest run src/components/__tests__/HotFilesList.test.tsx` from the `webview-ui` directory.
- Uses `@testing-library/react` for rendering.
- No mocking needed beyond what the global setup provides.
