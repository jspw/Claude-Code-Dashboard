# Spec 08: MarkdownView Unit Tests

## Target File
`webview-ui/src/components/__tests__/MarkdownView.test.tsx`

## Source Under Test
`webview-ui/src/components/MarkdownView.tsx`

Exports:
- `MarkdownView({ content, compact? })` - renders markdown string to HTML
- `CommandBlock({ command: { name, content } })` - collapsible command block

## Test Framework
- Vitest (globals enabled, jsdom environment)
- `@testing-library/react` + `@testing-library/jest-dom`
- Setup: `webview-ui/src/__tests__/setup.ts`

## Imports

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../helpers/render-helpers';
import { MarkdownView, CommandBlock } from '../../components/MarkdownView';
```

Note: `render` is the custom render from `webview-ui/src/__tests__/helpers/render-helpers.tsx`. `screen` and `fireEvent` are re-exported from there.

## No Mock Setup Required
These are pure presentational components with no external dependencies.

---

## Test Cases (15)

### Group: Headings (3 cases)

#### 1. Renders h1 with `#`
- Render: `<MarkdownView content="# Hello World" />`
- Assert: `screen.getByRole('heading', { level: 1 })` exists with text `"Hello World"`

#### 2. Renders h2 with `##`
- Render: `<MarkdownView content="## Section Title" />`
- Assert: `screen.getByRole('heading', { level: 2 })` exists with text `"Section Title"`

#### 3. Renders h3 with `###`
- Render: `<MarkdownView content="### Subsection" />`
- Assert: `screen.getByRole('heading', { level: 3 })` exists with text `"Subsection"`

### Group: Lists (2 cases)

#### 4. Renders unordered list with `- ` items
- Content:
  ```
  - Item one
  - Item two
  - Item three
  ```
- Assert: `screen.getByRole('list')` exists, `screen.getAllByRole('listitem')` has length 3
- Assert: list items contain text `"Item one"`, `"Item two"`, `"Item three"`

#### 5. Renders ordered list with `1. ` items
- Content:
  ```
  1. First
  2. Second
  3. Third
  ```
- Assert: container has an `<ol>` element
- Assert: `screen.getAllByRole('listitem')` has length 3
- Assert: list items contain `"First"`, `"Second"`, `"Third"`

### Group: Code Blocks (2 cases)

#### 6. Renders fenced code block
- Content:
  ````
  ```js
  const x = 1;
  ```
  ````
- Assert: a `<pre>` element exists in the container
- Assert: a `<code>` element inside `<pre>` has text content `"const x = 1;"`

#### 7. Renders inline code with backticks
- Content: `` Use `npm install` to setup ``
- Assert: a `<code>` element exists with text `"npm install"`
- Assert: surrounding text `"Use"` and `"to setup"` is present

### Group: Inline Formatting (3 cases)

#### 8. Renders bold with `**`
- Content: `This is **bold** text`
- Assert: a `<strong>` element exists with text `"bold"`

#### 9. Renders italic with `*`
- Content: `This is *italic* text`
- Assert: an `<em>` element exists with text `"italic"`

#### 10. Renders inline code within paragraph
- Content: `Run \`vitest\` now`
- Assert: `<code>` with text `"vitest"` exists

### Group: Paragraphs (2 cases)

#### 11. Renders plain text as paragraph
- Content: `Hello world`
- Assert: a `<p>` element exists with text `"Hello world"`

#### 12. Joins contiguous lines into single paragraph
- Content: `Line one\nLine two\nLine three`
- Assert: exactly one `<p>` element
- Assert: paragraph text content is `"Line one Line two Line three"` (joined with spaces)

### Group: Horizontal Rule (1 case)

#### 13. Renders horizontal rule from `---`
- Content: `Above\n\n---\n\nBelow`
- Assert: an `<hr>` element exists in the container (use `container.querySelector('hr')`)

### Group: Compact Mode (1 case)

#### 14. Applies no padding when compact=true
- Render: `<MarkdownView content="Hello" compact />`
- Assert: the wrapper `<div>` does NOT have the class `p-4`
- Render without compact: `<MarkdownView content="Hello" />`
- Assert: the wrapper `<div>` has the class `p-4`

### Group: CommandBlock (1 case)

#### 15. Renders command name, toggles content on click
- Render: `<CommandBlock command={{ name: 'test-cmd', content: '# Command Output\nSome text' }} />`
- Assert: `screen.getByText('/test-cmd')` is visible
- Assert: `"Command Output"` is NOT in the document (collapsed by default)
- Action: `fireEvent.click(screen.getByText('/test-cmd'))` (click the button)
- Assert: `screen.getByText('Command Output')` is now visible (expanded)
- Action: click again
- Assert: `"Command Output"` is removed from DOM (collapsed again)

---

## Validation Criteria

- All 15 tests pass with `cd webview-ui && npx vitest run src/components/__tests__/MarkdownView.test.tsx`
- No mocks needed (pure rendering tests)
- Use `container.querySelector()` for element type queries when `screen` queries are insufficient (e.g., `<hr>`, `<pre>`, `<ol>`)
- For compact mode test, inspect the outermost div's `className` attribute
