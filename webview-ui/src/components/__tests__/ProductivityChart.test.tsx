import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import ProductivityChart from '../ProductivityChart';

describe('ProductivityChart', () => {
  it('renders empty states and populated chart', () => {
    const { rerender } = render(<ProductivityChart data={[]} />);
    expect(screen.getByText('No productivity data yet.')).toBeInTheDocument();

    rerender(<ProductivityChart data={[{ hour: 10, avgToolCalls: 0, avgFilesModified: 0, sessionCount: 0 }]} />);
    expect(screen.getByText('No session data yet.')).toBeInTheDocument();

    rerender(<ProductivityChart data={[{ hour: 10, avgToolCalls: 3, avgFilesModified: 1, sessionCount: 2 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
