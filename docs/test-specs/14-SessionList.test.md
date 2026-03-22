# Spec 14: SessionList Unit Tests

## Target File
`webview-ui/src/components/__tests__/SessionList.test.tsx`

## Source Under Test
`webview-ui/src/components/SessionList.tsx` (default export `SessionList`)

Props:
```ts
{
  sessions: Session[];
  selectedId?: string;
  onSelect: (session: Session) => void;
}
```

The component sorts sessions by `startTime` descending, renders each as a button showing date, duration, token count, prompt count, and optionally activity ratio with color coding.

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../helpers/render-helpers';
import SessionList from '../../components/SessionList';
import { makeSession } from '../fixtures/test-data';
```

## Mock Setup
No mocks needed beyond the standard setup.

## Sample Data

```tsx
const now = Date.now();

const sessions = [
  makeSession({
    id: 'sess-1',
    startTime: now - 3 * 86_400_000, // 3 days ago (oldest)
    durationMs: 1_800_000, // 30 min
    totalTokens: 25000,
    promptCount: 8,
    activityRatio: 75, // green
  }),
  makeSession({
    id: 'sess-2',
    startTime: now - 86_400_000, // 1 day ago (newest)
    durationMs: 3_600_000, // 1 hour
    totalTokens: 50000,
    promptCount: 15,
    activityRatio: 45, // yellow
  }),
  makeSession({
    id: 'sess-3',
    startTime: now - 2 * 86_400_000, // 2 days ago (middle)
    durationMs: 600_000, // 10 min
    totalTokens: 8000,
    promptCount: 3,
    activityRatio: 25, // default (no color class)
  }),
];
```

---

## Test Cases (6)

#### 1. Renders all sessions
- Render: `<SessionList sessions={sessions} onSelect={vi.fn()} />`
- Assert: 3 buttons are rendered (`screen.getAllByRole('button')` has length 3)

#### 2. Sorts by startTime desc
- Render: `<SessionList sessions={sessions} onSelect={vi.fn()} />`
- Get all buttons: `screen.getAllByRole('button')`
- The first button should correspond to `sess-2` (newest, 1 day ago)
- The last button should correspond to `sess-1` (oldest, 3 days ago)
- Assert by checking the date text or order: the first button's text content should contain the date string for `sess-2`'s startTime, etc.
- Alternatively, use the dates: `new Date(now - 86_400_000).toLocaleDateString()` should appear first

#### 3. Highlights selected session
- Render: `<SessionList sessions={sessions} selectedId="sess-2" onSelect={vi.fn()} />`
- The selected button should have the active selection background class
- Assert: one of the buttons has a `className` that includes `bg-[var(--vscode-list-activeSelectionBackground)]`
- The non-selected buttons should NOT have this class

#### 4. Shows duration
- Render: `<SessionList sessions={sessions} onSelect={vi.fn()} />`
- The component's local `formatDuration` formats 1_800_000ms as `"30m 0s"` and 3_600_000ms as `"1h 0m"`
- Assert: `screen.getByText(/30m 0s/)` is in the document
- Assert: `screen.getByText(/1h 0m/)` is in the document

#### 5. Shows token count
- Render: `<SessionList sessions={sessions} onSelect={vi.fn()} />`
- The component's local `formatTokens` formats 50000 as `"50.0k"`, 25000 as `"25.0k"`, 8000 as `"8.0k"`
- Assert: `screen.getByText(/50\.0k tokens/)` is in the document
- Assert: `screen.getByText(/25\.0k tokens/)` is in the document

#### 6. Shows activity ratio with color coding
- Render: `<SessionList sessions={sessions} onSelect={vi.fn()} />`
- Session with `activityRatio: 75` (>= 70): rendered with `text-green-400` class
- Session with `activityRatio: 45` (>= 40, < 70): rendered with `text-yellow-400` class
- Session with `activityRatio: 25` (< 40): rendered with no special color class
- Assert: `screen.getByText('75% active')` is in the document and its element has class `text-green-400`
- Assert: `screen.getByText('45% active')` is in the document and its element has class `text-yellow-400`
- Assert: `screen.getByText('25% active')` is in the document and its element does NOT have class `text-green-400` or `text-yellow-400`

---

## Validation Criteria

- All 6 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/SessionList.test.tsx`
- `onSelect` is a `vi.fn()` spy; can optionally verify it's called on button click
- Color coding assertions check the `className` of the `<span>` containing the activity ratio text
- No external mocks needed
