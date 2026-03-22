import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import PatternChart from '../PatternChart';

describe('PatternChart', () => {
  it('renders empty and populated states', () => {
    const { rerender } = render(<PatternChart data={[{ category: 'Fix/Bug', count: 0 }]} />);
    expect(screen.getByText('No prompt data yet.')).toBeInTheDocument();

    rerender(<PatternChart data={[{ category: 'Fix/Bug', count: 2 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
