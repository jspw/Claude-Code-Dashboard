import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import UsageLineChart from '../UsageLineChart';

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
});
