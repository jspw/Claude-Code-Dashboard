import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import ProductivityChart, { ProductivityChartTooltip, formatProductivityHour, formatProductivityTick } from '../ProductivityChart';

describe('ProductivityChart', () => {
  it('renders empty states and populated chart', () => {
    const { rerender } = render(<ProductivityChart data={[]} />);
    expect(screen.getByText('No productivity data yet.')).toBeInTheDocument();

    rerender(<ProductivityChart data={[{ hour: 10, avgToolCalls: 0, avgFilesModified: 0, sessionCount: 0 }]} />);
    expect(screen.getByText('No session data yet.')).toBeInTheDocument();

    rerender(<ProductivityChart data={[{ hour: 10, avgToolCalls: 3, avgFilesModified: 1, sessionCount: 2 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('formats tooltip content and hour labels', () => {
    render(
      <ProductivityChartTooltip
        active
        label={9}
        payload={[
          { name: 'Sessions', value: 2, color: '#6366f1' },
          { name: 'Avg Tool Calls', value: 3, color: '#f59e0b' },
        ]}
      />
    );

    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Sessions: 2')).toBeInTheDocument();
    expect(screen.getByText('Avg Tool Calls: 3')).toBeInTheDocument();
    expect(formatProductivityHour(14)).toBe('14:00');
    expect(formatProductivityHour()).toBe('');
    expect(formatProductivityTick(7)).toBe('07h');
    expect(render(<ProductivityChartTooltip />).container).toBeEmptyDOMElement();
  });
});
