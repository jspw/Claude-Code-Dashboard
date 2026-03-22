import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import ProjectBarChart from '../ProjectBarChart';

describe('ProjectBarChart', () => {
  it('renders project bar chart data', () => {
    render(<ProjectBarChart data={[{ id: 'p1', name: 'VeryLongProjectName', tokens: 1000, costUsd: 0.1 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
