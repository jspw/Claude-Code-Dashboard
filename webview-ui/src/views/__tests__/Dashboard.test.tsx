import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { mockPostMessage } from '../../__tests__/setup';
import {
  makeBudgetStatus,
  makeEfficiency,
  makeHotFile,
  makeProductivityHour,
  makeProject,
  makeProjectUsage,
  makeRecentChange,
  makeStats,
  makeStreak,
  makeWeeklyRecap,
} from '../../__tests__/fixtures/test-data';
import Dashboard from '../Dashboard';

describe('Dashboard view', () => {
  beforeEach(() => { mockPostMessage.mockClear(); });

  it('renders home data, filters and sorts projects, and shows analytics tab', () => {
    const active = makeProject({ id: 'a', name: 'Alpha', isActive: true, totalCostUsd: 1, sessionCount: 3 });
    const beta = makeProject({ id: 'b', name: 'Beta', isActive: false, totalCostUsd: 3, sessionCount: 1, lastActive: Date.now() - 1000 });
    const gamma = makeProject({ id: 'c', name: 'Gamma', isActive: false, totalCostUsd: 2, sessionCount: 5, lastActive: Date.now() - 2000 });

    render(<Dashboard
      projects={[active, beta, gamma]}
      stats={makeStats({ totalProjects: 3, activeSessionCount: 1, tokensTodayTotal: 25_000, costTodayUsd: 1.234, tokensWeekTotal: 150_000, costWeekUsd: 7.89 })}
      usageOverTime={[{ date: '1/15', tokens: 1000, costUsd: 0.1 }]}
      usageByProject={[makeProjectUsage()]}
      heatmapData={[{ hour: 10, day: 1, tokens: 100 }]}
      promptPatterns={[{ category: 'Fix/Bug', count: 1 }]}
      toolUsage={[{ tool: 'Read', count: 5, percentage: 100 }]}
      hotFiles={[makeHotFile()]}
      projectedCost={{ dailyAvgCost: 1, projectedMonthCost: 31, currentMonthCost: 15, daysElapsed: 15, daysRemaining: 16 }}
      streak={makeStreak()}
      efficiency={makeEfficiency()}
      weeklyRecap={makeWeeklyRecap()}
      recentChanges={[makeRecentChange()]}
      productivityByHour={[makeProductivityHour()]}
      budgetStatus={makeBudgetStatus({ pct: 0.85, spentUsd: 8.5, budgetUsd: 10 })}
      showTour={false}
    />);

    expect(screen.getByText('Claude Code Dashboard')).toBeInTheDocument();
    expect(screen.getByText('25.0k')).toBeInTheDocument();
    expect(screen.getByText('Monthly budget 80% used')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'setBudget' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'a' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'b' });

    fireEvent.change(screen.getByPlaceholderText('Filter by name…'), { target: { value: 'bet' } });
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Last active'), { target: { value: 'sessions' } });
    fireEvent.change(screen.getByPlaceholderText('Filter by name…'), { target: { value: '' } });
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText('Token Usage — Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Prompt Categories')).toBeInTheDocument();
    expect(screen.getByText('Productivity by Hour')).toBeInTheDocument();
    expect(screen.getByText('Recent File Changes (last 7 days)')).toBeInTheDocument();

    // Range toggle updates the chart title
    fireEvent.click(screen.getByText('7d'));
    expect(screen.getByText('Token Usage — Last 7 Days')).toBeInTheDocument();
  });

  it('shows the tour when enabled and an empty state with no data', () => {
    render(<Dashboard projects={[]} stats={makeStats({ totalProjects: 0, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 })} showTour={true} />);

    // No data → empty state, no project list
    expect(screen.getByText('No Claude sessions found yet')).toBeInTheDocument();
    expect(screen.queryByText('Active now')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'refresh' });

    // Analytics still renders its empty chart states
    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText('No usage data available.')).toBeInTheDocument();
    expect(screen.getByText('No project usage data available.')).toBeInTheDocument();
    expect(screen.getByText('No prompt data yet.')).toBeInTheDocument();
    expect(screen.getByText('No heatmap data available.')).toBeInTheDocument();
  });

  it('renders the empty project filter message when data exists but nothing matches', () => {
    render(<Dashboard
      projects={[makeProject({ id: 'x', name: 'Xylo', isActive: false })]}
      stats={makeStats({ totalProjects: 1, activeSessionCount: 0 })}
      showTour={false}
    />);

    fireEvent.change(screen.getByPlaceholderText('Filter by name…'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No projects match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set a monthly budget' }));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'setBudget' });
  });

  it('renders and handles the welcome tour and budget progress controls', () => {
    render(<Dashboard
      projects={[makeProject({ id: 'p1', name: 'Project One' })]}
      stats={makeStats({ totalProjects: 1, activeSessionCount: 0 })}
      budgetStatus={makeBudgetStatus({ budgetUsd: 100, spentUsd: 25, pct: 0.25 })}
      showTour
    />);

    expect(screen.getByText('Local & private')).toBeInTheDocument();
    expect(screen.getByText('$25.00 spent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss welcome' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'dismissTour' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'setBudget' });
  });
});
