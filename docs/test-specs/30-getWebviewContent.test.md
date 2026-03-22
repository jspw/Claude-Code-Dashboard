# Spec 30: getWebviewContent Unit Tests

## Test File Path
`src/webviews/__tests__/getWebviewContent.test.ts`

## Source Under Test
`src/webviews/getWebviewContent.ts`

## Setup

### Imports
```typescript
import { describe, it, expect, vi } from 'vitest';
import { getWebviewContent } from '../getWebviewContent';
```

### Mocks
The `vscode` module is already mocked globally via `src/__tests__/setup.ts` (which mocks `vscode` using `src/__tests__/__mocks__/vscode.ts`). That mock provides `Uri.joinPath`.

### Mock Webview and Extension URI
```typescript
const mockWebview = {
  asWebviewUri: vi.fn((uri: any) => uri),
  cspSource: 'test-csp',
};

const mockExtensionUri = {
  fsPath: '/test/extension',
  scheme: 'file',
  path: '/test/extension',
};
```

---

## Test Cases

### Test 1: returns valid HTML string

**Description**: The function returns a string that starts with `<!DOCTYPE html>` and contains essential HTML structure.

**Steps**:
1. Call `getWebviewContent(mockWebview as any, mockExtensionUri as any, 'dashboard', {})`.

**Assertions**:
- Result starts with `<!DOCTYPE html>`.
- Result contains `<html lang="en">`.
- Result contains `<div id="root"></div>`.
- Result contains `</html>`.

---

### Test 2: includes script tag with nonce

**Description**: The HTML includes a `<script>` tag with a `nonce` attribute for CSP compliance.

**Steps**:
1. Call `getWebviewContent(mockWebview as any, mockExtensionUri as any, 'dashboard', {})`.

**Assertions**:
- Result matches regex `/nonce="[A-Za-z0-9]{32}"/` (nonce attribute with 32 alphanumeric chars).
- Result contains `<script nonce="`.

---

### Test 3: includes style link

**Description**: The HTML includes a `<link rel="stylesheet">` tag.

**Steps**:
1. Call `getWebviewContent(mockWebview as any, mockExtensionUri as any, 'dashboard', {})`.

**Assertions**:
- Result contains `<link rel="stylesheet"`.
- `mockWebview.asWebviewUri` was called (used to resolve the CSS URI).

---

### Test 4: sets __INITIAL_VIEW__ correctly

**Description**: The HTML sets `window.__INITIAL_VIEW__` to the provided view parameter.

**Steps**:
1. Call with view `'dashboard'`: result should contain `window.__INITIAL_VIEW__ = "dashboard"`.
2. Call with view `'project'`: result should contain `window.__INITIAL_VIEW__ = "project"`.
3. Call with view `'sidebar'`: result should contain `window.__INITIAL_VIEW__ = "sidebar"`.

**Assertions**:
- For each call, the corresponding `__INITIAL_VIEW__` string is present in the output.

---

### Test 5: serializes __INITIAL_DATA__ as JSON

**Description**: The `initialData` parameter is serialized via `JSON.stringify` and assigned to `window.__INITIAL_DATA__`.

**Steps**:
1. Call with `initialData = { projects: [{ id: 'p1', name: 'Test' }], count: 42 }`.

**Assertions**:
- Result contains `window.__INITIAL_DATA__ =`.
- Extract the JSON portion from the HTML and parse it. It should deep-equal the input object.
  - Use regex to extract: `/window\.__INITIAL_DATA__ = (.+?);/s`
  - `JSON.parse(match[1])` should deep-equal the input.

---

### Test 6: escapes `</` in JSON to prevent XSS

**Description**: The source code replaces `</` with `<\/` in the serialized JSON to prevent script injection via `</script>` sequences in data.

**Steps**:
1. Call with `initialData = { html: '</script><script>alert(1)</script>' }`.

**Assertions**:
- Result should NOT contain the literal string `</script><script>alert(1)</script>` inside the data assignment.
- Result should contain `<\\/script>` (the escaped form) within the `__INITIAL_DATA__` assignment.
- More precisely: the raw HTML string should not contain `</script>` between `__INITIAL_DATA__ =` and the next `</script>` tag.

---

### Test 7: generates 32-char nonce

**Description**: The nonce used in the HTML is exactly 32 characters long and composed of alphanumeric characters.

**Steps**:
1. Call `getWebviewContent(mockWebview as any, mockExtensionUri as any, 'dashboard', {})`.
2. Extract nonce from the result using regex: `/nonce="([A-Za-z0-9]+)"/`.

**Assertions**:
- Extracted nonce has length 32.
- Nonce matches `/^[A-Za-z0-9]{32}$/`.
- Call the function twice and extract nonces from both results. They should be different (randomness check, though this is probabilistic -- acceptable for a unit test).

---

## Validation Criteria
- All 7 tests pass with `npx vitest run src/webviews/__tests__/getWebviewContent.test.ts`.
- The vscode mock is provided by the global setup; no additional vscode mocking needed.
- No real filesystem access.
