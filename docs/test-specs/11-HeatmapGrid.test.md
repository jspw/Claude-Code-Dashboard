# Spec 11: HeatmapGrid Unit Tests

## Target File
`webview-ui/src/components/__tests__/HeatmapGrid.test.tsx`

## Source Under Test
`webview-ui/src/components/HeatmapGrid.tsx` (default export `HeatmapGrid`)

Props: `{ data: HeatmapCell[] }` where `HeatmapCell = { hour: number; day: number; tokens: number }`

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../helpers/render-helpers';
import HeatmapGrid from '../../components/HeatmapGrid';
import { makeHeatmapCell } from '../fixtures/test-data';
```

## Mock Setup
No mocks needed. Pure presentational component.

## Sample Data

```tsx
const sampleData = [
  makeHeatmapCell({ day: 0, hour: 9, tokens: 5000 }),   // Sun 9am
  makeHeatmapCell({ day: 1, hour: 14, tokens: 15000 }),  // Mon 2pm
  makeHeatmapCell({ day: 4, hour: 10, tokens: 8000 }),   // Thu 10am
];
```

---

## Test Cases (5)

#### 1. Renders 7 day rows
- Render: `<HeatmapGrid data={sampleData} />`
- The component renders 7 rows (one per day, indices 0-6). Each row is a `<div>` containing the day label and 24 hour cells.
- Assert: all 7 day labels are present: `screen.getByText('Sun')`, `screen.getByText('Mon')`, ..., `screen.getByText('Sat')`

#### 2. Renders 24 hour columns per row
- Render: `<HeatmapGrid data={sampleData} />`
- Each day row has 24 cells (small divs). The total number of hour cells across all rows is `7 * 24 = 168`.
- Use `container.querySelectorAll` to count cells. Each cell has a `style` attribute with `flex: 1` and `height: 16px`.
- Assert: the container has at least 168 cell divs with inline style `height` of `16px` (use `container.querySelectorAll('[style*="height: 16px"]')` or similar; alternatively count the children of each row minus the label div)

#### 3. Shows day labels (Sun-Sat)
- Render: `<HeatmapGrid data={[]} />`
- Assert: all 7 day label strings are present: `'Sun'`, `'Mon'`, `'Tue'`, `'Wed'`, `'Thu'`, `'Fri'`, `'Sat'`
- Use `screen.getByText()` for each

#### 4. Shows tooltip for cells with tokens
- Render: `<HeatmapGrid data={sampleData} />`
- The cell at day=1, hour=14 with 15000 tokens should have a `title` attribute: `"Mon 14:00 — 15.0k tokens"`
- Assert: `screen.getByTitle('Mon 14:00 — 15.0k tokens')` is in the document
- Also check: `screen.getByTitle('Sun 9:00 — 5.0k tokens')` exists

#### 5. Renders legend
- Render: `<HeatmapGrid data={sampleData} />`
- Assert: `screen.getByText('Less')` is in the document
- Assert: `screen.getByText('More')` is in the document
- The legend contains 5 colored squares between "Less" and "More" labels

---

## Validation Criteria

- All 5 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/HeatmapGrid.test.tsx`
- No mocks needed
- Use `container` from `render()` return value for DOM queries that `screen` cannot handle
- The component uses inline styles (not CSS classes), so attribute selectors or `element.style` checks are appropriate
