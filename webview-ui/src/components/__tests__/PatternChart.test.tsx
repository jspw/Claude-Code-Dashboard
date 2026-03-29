import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import PatternChart, { PatternChartTooltip, getPatternCategoryColor } from '../PatternChart';

describe('PatternChart', () => {
  it('renders empty and populated states', () => {
    const { rerender } = render(<PatternChart data={[{ category: 'Fix/Bug', count: 0 }]} />);
    expect(screen.getByText('No prompt data yet.')).toBeInTheDocument();

    rerender(<PatternChart data={[{ category: 'Fix/Bug', count: 2 }, { category: 'Custom', count: 1 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(getPatternCategoryColor('Fix/Bug')).toBe('#ef4444');
    expect(getPatternCategoryColor('Custom')).toBe('#6366f1');
  });

  it('renders tooltip details with singular and plural prompt labels', () => {
    const { rerender } = render(
      <PatternChartTooltip active payload={[{ value: 1, payload: { category: 'Explain', count: 1 } }]} />
    );

    expect(screen.getByText('Explain')).toBeInTheDocument();
    expect(screen.getByText('1 prompt')).toBeInTheDocument();

    rerender(
      <PatternChartTooltip active payload={[{ value: 2, payload: { category: 'Feature', count: 2 } }]} />
    );

    expect(screen.getByText('2 prompts')).toBeInTheDocument();
  });
});
