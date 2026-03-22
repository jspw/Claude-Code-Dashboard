# Spec 15: LiveSessionBanner Unit Tests

## Target File
`webview-ui/src/components/__tests__/LiveSessionBanner.test.tsx`

## Source Under Test
`webview-ui/src/components/LiveSessionBanner.tsx` (default export `LiveSessionBanner`)

Props: `{ activeCount: number }`

The component returns `null` when `activeCount === 0`. Otherwise renders a green banner with a pulsing dot and text like `"N active session(s) running"` with correct singular/plural.

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../helpers/render-helpers';
import LiveSessionBanner from '../../components/LiveSessionBanner';
```

## Mock Setup
No mocks needed. Pure presentational component.

---

## Test Cases (3)

#### 1. Returns null when activeCount=0
- Render: `const { container } = render(<LiveSessionBanner activeCount={0} />)`
- Assert: `container.firstChild` is `null`

#### 2. Shows singular "1 active session running"
- Render: `<LiveSessionBanner activeCount={1} />`
- Assert: `screen.getByText('1 active session running')` is in the document
- Note: when `activeCount === 1`, the text is `"1 active session running"` (no "s")
- Assert: a pulsing dot is present (`container.querySelector('.animate-pulse')` is not null)

#### 3. Shows plural "3 active sessions running"
- Render: `<LiveSessionBanner activeCount={3} />`
- Assert: `screen.getByText('3 active sessions running')` is in the document
- Note: when `activeCount > 1`, the text is `"3 active sessions running"` (with "s")

---

## Validation Criteria

- All 3 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/LiveSessionBanner.test.tsx`
- No mocks needed
- Extremely straightforward component -- tests should be concise
