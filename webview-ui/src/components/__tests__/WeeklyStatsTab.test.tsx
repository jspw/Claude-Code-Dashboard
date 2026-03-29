import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import WeeklyStatsTab, { formatWeeklyTooltipValue } from '../WeeklyStatsTab';

describe('WeeklyStatsTab', () => {
  it('renders empty and populated weekly stats states', () => {
    const { rerender } = render(<WeeklyStatsTab />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();

    rerender(<WeeklyStatsTab projectStats={{
      usageOverTime: [],
      toolUsage: [],
      promptPatterns: [],
      efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
      recentToolCalls: [],
      weeklyStats: {
        sessions: 3,
        tokens: 2500,
        costUsd: 0.125,
        dailyBreakdown: [
          { date: '1/14', tokens: 500, costUsd: 0.025, sessions: 1 },
          { date: '1/15', tokens: 2000, costUsd: 0.1, sessions: 2 },
        ],
      },
    }} />);

    expect(screen.getByText('Sessions this week')).toBeInTheDocument();
    expect(screen.getByText('2.5k')).toBeInTheDocument();
    expect(screen.getByText('$0.125')).toBeInTheDocument();
    expect(screen.getByText('1 session')).toBeInTheDocument();
  });

  it('renders the no-activity state and formats tooltip values', () => {
    render(<WeeklyStatsTab projectStats={{
      usageOverTime: [],
      toolUsage: [],
      promptPatterns: [],
      efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
      recentToolCalls: [],
      weeklyStats: {
        sessions: 0,
        tokens: 0,
        costUsd: 0,
        dailyBreakdown: [
          { date: '1/14', tokens: 0, costUsd: 0, sessions: 0 },
          { date: '1/15', tokens: 0, costUsd: 0, sessions: 0 },
        ],
      },
    }} />);

    expect(screen.getByText('No activity in the last 7 days.')).toBeInTheDocument();
    expect(formatWeeklyTooltipValue(1250, 'tokens')).toEqual(['1.3k', 'tokens']);
    expect(formatWeeklyTooltipValue(0.125, 'costUsd')).toEqual(['$0.1250', 'costUsd']);
  });
});
