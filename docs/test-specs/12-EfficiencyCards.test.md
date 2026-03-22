# Spec 12: EfficiencyCards Unit Tests

## Target File
`webview-ui/src/components/__tests__/EfficiencyCards.test.tsx`

## Source Under Test
`webview-ui/src/components/EfficiencyCards.tsx` (default export `EfficiencyCards`)

Props: `{ data: EfficiencyStats }` where:
```ts
interface EfficiencyStats {
  avgTokensPerPrompt: number;
  avgToolCallsPerSession: number;
  avgSessionDurationMin: number;
  firstTurnResolutionRate: number;
  avgActiveRatio: number;
}
```

The component renders 5 stat cards. Returns `null` when `data` is falsy.

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../helpers/render-helpers';
import EfficiencyCards from '../../components/EfficiencyCards';
import { makeEfficiency } from '../fixtures/test-data';
```

## Mock Setup
No mocks needed. Pure presentational component.

## Sample Data

```tsx
const defaultData = makeEfficiency({
  avgTokensPerPrompt: 5000,
  avgToolCallsPerSession: 8.5,
  avgSessionDurationMin: 25,
  firstTurnResolutionRate: 30,
  avgActiveRatio: 65,
});
```

---

## Test Cases (5)

#### 1. Returns null when data is falsy
- Render: `<EfficiencyCards data={null as any} />`
- Assert: `container.firstChild` is `null` (nothing rendered)

#### 2. Renders 5 stat cards
- Render: `<EfficiencyCards data={defaultData} />`
- Assert: exactly 5 card labels are present:
  - `screen.getByText('Avg tokens / prompt')`
  - `screen.getByText('Avg tool calls / session')`
  - `screen.getByText('Avg session duration')`
  - `screen.getByText('First-turn resolution')`
  - `screen.getByText('Avg active rate')`

#### 3. Shows avg tokens/prompt
- Render: `<EfficiencyCards data={defaultData} />`
- Assert: `screen.getByText('5,000')` is in the document (formatted with `toLocaleString()`)
- Note: `(5000).toLocaleString()` produces `"5,000"` in en-US locale

#### 4. Shows first-turn resolution rate with %
- Render: `<EfficiencyCards data={defaultData} />`
- Assert: `screen.getByText('30%')` is in the document
- The value is rendered as `${data.firstTurnResolutionRate}%` = `"30%"`

#### 5. Shows avg active rate with % unit
- Render: `<EfficiencyCards data={defaultData} />`
- Assert: `screen.getByText('65')` is in the document (the value)
- Assert: `screen.getByText('%')` is in the document (the unit span)
- The Card component renders the unit as a separate `<span>` element next to the value

---

## Validation Criteria

- All 5 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/EfficiencyCards.test.tsx`
- No mocks needed
- For the null test, check `container.firstChild === null`
- `toLocaleString()` formatting may vary by locale; if CI uses a non-en-US locale, the comma in `"5,000"` might differ. Consider using a regex like `/5.000/` or setting locale explicitly if needed.
