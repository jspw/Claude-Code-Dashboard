# Spec 13: ProjectCard Unit Tests

## Target File
`webview-ui/src/components/__tests__/ProjectCard.test.tsx`

## Source Under Test
`webview-ui/src/components/ProjectCard.tsx` (default export `ProjectCard`)

Props: `{ project: Project }`

The component renders a button that shows project name, path, token count, session count, time ago, and an active indicator when `isActive` is true. Clicking calls `vscode.postMessage({ type: 'openProject', projectId })`.

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../helpers/render-helpers';
import ProjectCard from '../../components/ProjectCard';
import { makeProject } from '../fixtures/test-data';
```

## Mock Setup

The component imports `vscode` from `../../vscode` which calls `acquireVsCodeApi()`. The test setup file (`webview-ui/src/__tests__/setup.ts`) already mocks `acquireVsCodeApi` on `globalThis`, so no additional mock is needed.

## Sample Data

```tsx
const now = Date.now();

const activeProject = makeProject({
  id: 'proj-active',
  name: 'my-cool-project',
  path: '/home/user/my-cool-project',
  totalTokens: 150000,
  sessionCount: 12,
  lastActive: now - 3_600_000, // 1 hour ago
  isActive: true,
});

const inactiveProject = makeProject({
  id: 'proj-inactive',
  name: 'old-project',
  path: '/home/user/old-project',
  totalTokens: 2500000,
  sessionCount: 50,
  lastActive: now - 3 * 86_400_000, // 3 days ago
  isActive: false,
});
```

---

## Test Cases (6)

#### 1. Renders project name
- Render: `<ProjectCard project={activeProject} />`
- Assert: `screen.getByText('my-cool-project')` is in the document

#### 2. Renders project path
- Render: `<ProjectCard project={activeProject} />`
- Assert: `screen.getByText('/home/user/my-cool-project')` is in the document

#### 3. Shows token count
- Render: `<ProjectCard project={activeProject} />`
- The component's local `formatTokens` formats 150000 as `"150.0k"`
- Assert: `screen.getByText(/150\.0k tokens/)` is in the document
- Also test millions: render with `totalTokens: 2500000` (from `inactiveProject`)
- Assert: `screen.getByText(/2\.5M tokens/)` is in the document

#### 4. Shows session count
- Render: `<ProjectCard project={activeProject} />`
- Assert: `screen.getByText(/12 sessions/)` is in the document

#### 5. Shows time ago
- Render: `<ProjectCard project={activeProject} />` (lastActive = 1 hour ago)
- The component's `timeAgo` function returns `"1h ago"` for 1 hour
- Assert: `screen.getByText('1h ago')` is in the document
- Render: `<ProjectCard project={inactiveProject} />` (lastActive = 3 days ago)
- Assert: `screen.getByText('3d ago')` is in the document

#### 6. Shows live indicator when active
- Render: `<ProjectCard project={activeProject} />`
- Assert: `screen.getByText('live')` is in the document
- Assert: a pulsing dot element exists (an element with class `animate-pulse` -- use `container.querySelector('.animate-pulse')`)
- Render: `<ProjectCard project={inactiveProject} />`
- Assert: `screen.queryByText('live')` is NOT in the document

---

## Validation Criteria

- All 6 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/ProjectCard.test.tsx`
- The `timeAgo` function uses `Date.now()` internally; if tests are flaky due to timing, use `vi.useFakeTimers()` and `vi.setSystemTime()` to fix the current time
- No external mocks needed beyond the setup file's `acquireVsCodeApi` mock
