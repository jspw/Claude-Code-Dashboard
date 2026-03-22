# Spec 16: ToolUsageBar Component Tests

## Test File
**Path**: `webview-ui/src/components/__tests__/ToolUsageBar.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/components/ToolUsageBar.tsx`

## Imports

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolUsageBar from '../ToolUsageBar';
import { ToolUsageStat } from '../../types';
```

## No Additional Mocks Required
The setup file at `src/__tests__/setup.ts` already handles `acquireVsCodeApi` and `ResizeObserver`. No recharts or other mocks needed for this component.

## Sample Data

```tsx
const sampleData: ToolUsageStat[] = [
  { tool: 'Read', count: 50, percentage: 50 },
  { tool: 'Edit', count: 30, percentage: 30 },
  { tool: 'Bash', count: 20, percentage: 20 },
];
```

## Test Cases

### Test 1: shows empty message when data is empty
**Description**: When `data` is an empty array, the component should display a "No tool usage data yet." message.

```tsx
it('shows empty message when data is empty', () => {
  render(<ToolUsageBar data={[]} />);
  expect(screen.getByText('No tool usage data yet.')).toBeInTheDocument();
});
```

**Assertions**:
- The text "No tool usage data yet." is present in the document.

### Test 2: renders tool names
**Description**: Each item's `tool` name should be displayed in the rendered output.

```tsx
it('renders tool names', () => {
  render(<ToolUsageBar data={sampleData} />);
  expect(screen.getByText('Read')).toBeInTheDocument();
  expect(screen.getByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Bash')).toBeInTheDocument();
});
```

**Assertions**:
- "Read", "Edit", and "Bash" are all present in the document.

### Test 3: shows count and percentage
**Description**: Each row should display the count followed by the percentage in parentheses, e.g., "50 (50%)".

```tsx
it('shows count and percentage for each tool', () => {
  render(<ToolUsageBar data={sampleData} />);
  expect(screen.getByText('50 (50%)')).toBeInTheDocument();
  expect(screen.getByText('30 (30%)')).toBeInTheDocument();
  expect(screen.getByText('20 (20%)')).toBeInTheDocument();
});
```

**Assertions**:
- "50 (50%)", "30 (30%)", and "20 (20%)" are all present.

### Test 4: renders bar with correct width proportions
**Description**: The inner bar div uses an inline `width` style calculated as `(item.count / maxCount) * 100`. The first item (highest count) should be 100%, and others should be proportional.

```tsx
it('renders bar with correct width proportions', () => {
  const { container } = render(<ToolUsageBar data={sampleData} />);
  // The inner bar divs have inline style with width percentage
  // maxCount = 50 (first item's count)
  // Read: (50/50)*100 = 100%, Edit: (30/50)*100 = 60%, Bash: (20/50)*100 = 40%
  const bars = container.querySelectorAll('.h-full.rounded.transition-all');
  expect(bars).toHaveLength(3);
  expect((bars[0] as HTMLElement).style.width).toBe('100%');
  expect((bars[1] as HTMLElement).style.width).toBe('60%');
  expect((bars[2] as HTMLElement).style.width).toBe('40%');
});
```

**Assertions**:
- There are 3 inner bar elements.
- First bar has width `100%`.
- Second bar has width `60%`.
- Third bar has width `40%`.

## Validation Criteria
- All 4 tests pass with `npx vitest run src/components/__tests__/ToolUsageBar.test.tsx` from the `webview-ui/` directory.
- No additional dependencies required beyond what is already in `package.json`.
