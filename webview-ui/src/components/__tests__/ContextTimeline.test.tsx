import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { Turn, TurnUsage } from '../../types';
import { TimelinePoint } from '../../utils/contextTimeline';
import ContextTimeline, { ContextTimelineTooltip } from '../ContextTimeline';

const MIN = 60_000;

function call(minute: number, usage: Partial<TurnUsage>): Turn {
  return {
    id: `a${minute}`, role: 'assistant', content: '', inputTokens: 0, outputTokens: 0, toolCalls: [],
    timestamp: minute * MIN,
    usage: { input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 100, costUsd: 0.01, model: 'claude-opus-5', ...usage },
  };
}

const TURNS = [
  call(0, { cacheWrite: 50_000 }),
  call(10, { cacheWrite: 60_000 }),
  call(11, { cacheWrite: 61_000, model: 'claude-sonnet-5' }),
  call(12, { cacheWrite: 20_000 }),
];

const point = (overrides: Partial<TimelinePoint>): TimelinePoint => ({
  call: 3, timestamp: 0, context: 52_000, cacheRead: 0, cacheWrite: 52_000, output: 1_200,
  costUsd: 0.094, gapMs: 0, event: null, ...overrides,
});

describe('ContextTimeline', () => {
  it('renders nothing until a session has two API calls', () => {
    const { container } = render(<ContextTimeline turns={TURNS.slice(0, 1)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('summarizes the session and draws the charts when expanded', () => {
    render(<ContextTimeline turns={TURNS} />);

    expect(screen.getByText('Context · 4 API calls')).toBeInTheDocument();
    expect(screen.getByText('peak 61.0k')).toBeInTheDocument();
    expect(screen.getByText('1 compaction')).toBeInTheDocument();
    expect(screen.getByText('2 cache misses (1 after idle)')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Cache miss')).toBeInTheDocument();
    expect(screen.getByText('Compaction')).toBeInTheDocument();
  });

  it('leaves out the event counts and legend when nothing happened', () => {
    render(<ContextTimeline turns={[call(0, { cacheWrite: 30_000 }), call(1, { cacheRead: 30_000 })]} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.queryByText(/compaction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cache miss/i)).not.toBeInTheDocument();
  });
});

describe('ContextTimelineTooltip', () => {
  it('shows the call\'s context, cost, and why its cache missed', () => {
    render(<ContextTimelineTooltip active payload={[{ payload: point({ gapMs: 10 * MIN, event: { kind: 'cacheMiss', reason: 'idle' } }) }]} />);

    expect(screen.getByText(/^Call 3/)).toBeInTheDocument();
    expect(screen.getByText('52.0k')).toBeInTheDocument();
    expect(screen.getByText('$0.094')).toBeInTheDocument();
    expect(screen.getByText('Cache miss after 10m 0s idle')).toBeInTheDocument();
    expect(screen.getByText('re-sent 52.0k uncached')).toBeInTheDocument();
  });

  it('describes compactions and other cache misses', () => {
    const { rerender } = render(
      <ContextTimelineTooltip active payload={[{ payload: point({ context: 30_000, event: { kind: 'compaction', from: 150_000 } }) }]} />,
    );
    expect(screen.getByText('Compacted: 150.0k → 30.0k')).toBeInTheDocument();

    rerender(<ContextTimelineTooltip active payload={[{ payload: point({ event: { kind: 'cacheMiss', reason: 'model' } }) }]} />);
    expect(screen.getByText('Cache miss: model switched')).toBeInTheDocument();

    rerender(<ContextTimelineTooltip active payload={[{ payload: point({ event: { kind: 'cacheMiss', reason: 'other' } }) }]} />);
    expect(screen.getByText('Cache miss: the cached prefix changed')).toBeInTheDocument();
  });

  it('renders nothing when inactive', () => {
    expect(render(<ContextTimelineTooltip />).container).toBeEmptyDOMElement();
  });
});
