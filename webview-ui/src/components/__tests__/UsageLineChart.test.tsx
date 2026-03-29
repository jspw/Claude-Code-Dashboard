import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import UsageLineChart, { UsageLineChartTooltip, createUsageTickFormatter, formatUsageTokens } from '../UsageLineChart';

describe('UsageLineChart', () => {
  it('renders the line chart with daily usage data', () => {
    render(<UsageLineChart data={[
      { date: '1/10', tokens: 100, costUsd: 0.01 },
      { date: '1/11', tokens: 200, costUsd: 0.02 },
      { date: '1/12', tokens: 300, costUsd: 0.03 },
      { date: '1/13', tokens: 400, costUsd: 0.04 },
      { date: '1/14', tokens: 500, costUsd: 0.05 },
      { date: '1/15', tokens: 600, costUsd: 0.06 },
      { date: '1/16', tokens: 700, costUsd: 0.07 },
    ]} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('formats usage labels and tooltip output', () => {
    render(
      <UsageLineChartTooltip
        active
        label="1/20"
        payload={[{ value: 1250, payload: { date: '1/20', tokens: 1250, costUsd: 0.125 } }]}
      />
    );

    expect(screen.getByText('1/20')).toBeInTheDocument();
    expect(screen.getByText('1k tokens')).toBeInTheDocument();
    expect(screen.getByText('$0.1250')).toBeInTheDocument();
    expect(formatUsageTokens(2_000_000)).toBe('2.0M');
    expect(formatUsageTokens(250)).toBe('250');
    expect(render(<UsageLineChartTooltip />).container).toBeEmptyDOMElement();

    const tickFormatter = createUsageTickFormatter([
      { date: '1/10', tokens: 10, costUsd: 0.01 },
      { date: '1/11', tokens: 20, costUsd: 0.02 },
      { date: '1/12', tokens: 30, costUsd: 0.03 },
      { date: '1/13', tokens: 40, costUsd: 0.04 },
      { date: '1/14', tokens: 50, costUsd: 0.05 },
      { date: '1/15', tokens: 60, costUsd: 0.06 },
      { date: '1/16', tokens: 70, costUsd: 0.07 },
      { date: '1/17', tokens: 80, costUsd: 0.08 },
    ]);

    expect(tickFormatter('ignored', 0)).toBe('1/10');
    expect(tickFormatter('ignored', 1)).toBe('');
    expect(tickFormatter('ignored', 2)).toBe('1/12');
  });
});
