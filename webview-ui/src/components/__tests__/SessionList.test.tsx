import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeSession } from '../../__tests__/fixtures/test-data';
import SessionList from '../SessionList';

describe('SessionList', () => {
  it('sorts sessions, selects one, and renders activity states', () => {
    const onSelect = vi.fn();
    const older = makeSession({ id: 'older', startTime: 1000, durationMs: 61_000, totalTokens: 1200, promptCount: 2, activityRatio: 75, model: 'claude-opus-4' });
    const newer = makeSession({ id: 'newer', startTime: 2000, durationMs: 10_000, totalTokens: 500, promptCount: 1, activityRatio: 50, model: 'claude-sonnet-4' });
    const lowest = makeSession({ id: 'low', startTime: 1500, durationMs: null, totalTokens: 50, promptCount: 3, activityRatio: 20, model: 'claude-haiku-4' });
    const unknown = makeSession({ id: 'unknown', startTime: 500, durationMs: 5_000, totalTokens: 25, promptCount: 1, activityRatio: null, model: 'claude-custom-next' });

    render(<SessionList sessions={[older, newer, lowest, unknown]} selectedId="newer" onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('500 tokens');
    expect(screen.getByText('75% active')).toBeInTheDocument();
    expect(screen.getByText('50% active')).toBeInTheDocument();
    expect(screen.getByText('20% active')).toBeInTheDocument();
    expect(screen.getByText('Opus')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Haiku')).toBeInTheDocument();
    expect(screen.queryByText('claude-custom-next')).not.toBeInTheDocument();
    expect(buttons[1]).toHaveTextContent('— · 50 tokens · 3 prompts · 20% active');

    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith(lowest);
  });
});
