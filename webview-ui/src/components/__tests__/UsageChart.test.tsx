import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import UsageChart from '../UsageChart';

describe('UsageChart', () => {
  it('renders the chart container', () => {
    render(<UsageChart data={[{ label: 'Mon', tokens: 1000, cost: 0.1 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
