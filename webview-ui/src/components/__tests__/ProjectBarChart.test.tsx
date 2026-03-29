import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import ProjectBarChart, { ProjectBarChartTooltip, formatProjectBarTokens } from '../ProjectBarChart';

describe('ProjectBarChart', () => {
  it('renders project bar chart data', () => {
    render(<ProjectBarChart data={[{ id: 'p1', name: 'VeryLongProjectName', tokens: 1000, costUsd: 0.1 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('formats token totals and tooltip details', () => {
    render(
      <ProjectBarChartTooltip
        active
        payload={[{ value: 1200000, payload: { id: 'p2', name: 'Large Project', tokens: 1200000, costUsd: 1.2345 } }]}
      />
    );

    expect(screen.getByText('Large Project')).toBeInTheDocument();
    expect(screen.getByText('1.2M tokens')).toBeInTheDocument();
    expect(screen.getByText('$1.2345')).toBeInTheDocument();
    expect(formatProjectBarTokens(1500)).toBe('2k');
    expect(formatProjectBarTokens(999)).toBe('999');
  });
});
