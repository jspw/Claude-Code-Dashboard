# Spec 10: PromptSearch Unit Tests

## Target File
`webview-ui/src/components/__tests__/PromptSearch.test.tsx`

## Source Under Test
`webview-ui/src/components/PromptSearch.tsx` (default export `PromptSearch`)

Props: `{ allPrompts: PromptSearchResult[] }`

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../helpers/render-helpers';
import PromptSearch from '../../components/PromptSearch';
import { makePromptSearchResult, makeTurn } from '../fixtures/test-data';
```

## Mock Setup
No mocks needed. Pure presentational component.

## Sample Data

```tsx
const samplePrompts = [
  makePromptSearchResult({
    projectName: 'dashboard',
    sessionId: 'sess-1',
    turn: makeTurn({ content: 'Fix the authentication bug' }),
    snippet: 'Fix the authentication bug',
  }),
  makePromptSearchResult({
    projectName: 'api-server',
    sessionId: 'sess-2',
    turn: makeTurn({ content: 'Add pagination to the user list' }),
    snippet: 'Add pagination to the user list',
  }),
  makePromptSearchResult({
    projectName: 'dashboard',
    sessionId: 'sess-3',
    turn: makeTurn({ content: 'Refactor the sidebar component' }),
    snippet: 'Refactor the sidebar component',
  }),
];
```

---

## Test Cases (8)

#### 1. Shows placeholder text when empty
- Render: `<PromptSearch allPrompts={[]} />`
- Assert: `screen.getByPlaceholderText('Search across all prompts...')` exists

#### 2. Shows "Type to search" when no query
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Assert: `screen.getByText(/Type to search across all prompts/)` is in the document
- Assert: no result cards are rendered

#### 3. Shows "No prompts found" for no matches
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Action: `fireEvent.change(screen.getByPlaceholderText('Search across all prompts...'), { target: { value: 'zzzznotfound' } })`
- Assert: `screen.getByText(/No prompts found matching/)` is in the document

#### 4. Filters prompts by content
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Action: type `"authentication"` into the search input
- Assert: `screen.getByText(/Fix the authentication bug/)` is in the document
- Assert: `"Add pagination"` is NOT in the document

#### 5. Filters prompts by project name
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Action: type `"api-server"` into the search input
- Assert: `screen.getByText('api-server')` is in the document (project name label)
- Assert: the pagination prompt result is shown

#### 6. Highlights matching text
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Action: type `"authentication"` into search input
- Assert: a `<mark>` element exists in the document (use `container.querySelector('mark')`)
- Assert: the `<mark>` element's text content is `"authentication"`

#### 7. Limits results to 50
- Create an array of 60 prompts: `Array.from({ length: 60 }, (_, i) => makePromptSearchResult({ snippet: \`test prompt \${i}\`, turn: makeTurn({ content: \`test prompt \${i}\` }) }))`
- Render with these prompts
- Action: type `"test prompt"` into search input
- Assert: the displayed result count text shows `"50 results"` (not 60)

#### 8. Shows result count
- Render: `<PromptSearch allPrompts={samplePrompts} />`
- Action: type `"dashboard"` into search input (matches 2 prompts by project name)
- Assert: `screen.getByText(/2 results/)` is in the document

---

## Validation Criteria

- All 8 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/PromptSearch.test.tsx`
- Interaction is done via `fireEvent.change` on the input element
- Use `screen.queryByText` for negative assertions (returns null)
- No mocks needed
