import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import WeeklyStatsTab from '../WeeklyStatsTab';

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
        sessions: 2,
        tokens: 2500,
        costUsd: 0.125,
        dailyBreakdown: [
          { date: '1/14', tokens: 0, costUsd: 0, sessions: 0 },
          { date: '1/15', tokens: 2500, costUsd: 0.125, sessions: 2 },
        ],
      },
    }} />);

    expect(screen.getByText('Sessions this week')).toBeInTheDocument();
    expect(screen.getByText('2.5k')).toBeInTheDocument();
    expect(screen.getByText('$0.125')).toBeInTheDocument();
  });
});
