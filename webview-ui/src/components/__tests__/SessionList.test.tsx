import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeSession } from '../../__tests__/fixtures/test-data';
import SessionList from '../SessionList';

describe('SessionList', () => {
  it('sorts sessions, selects one, and renders activity states', () => {
    const onSelect = vi.fn();
    const older = makeSession({ id: 'older', startTime: 1000, durationMs: 61_000, totalTokens: 1200, promptCount: 2, activityRatio: 75 });
    const newer = makeSession({ id: 'newer', startTime: 2000, durationMs: 10_000, totalTokens: 500, promptCount: 1, activityRatio: 50 });
    const lowest = makeSession({ id: 'low', startTime: 1500, durationMs: null, totalTokens: 50, promptCount: 3, activityRatio: 20 });

    render(<SessionList sessions={[older, newer, lowest]} selectedId="newer" onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('500 tokens');
    expect(screen.getByText('75% active')).toBeInTheDocument();
    expect(screen.getByText('50% active')).toBeInTheDocument();
    expect(screen.getByText('20% active')).toBeInTheDocument();
    expect(buttons[1]).toHaveTextContent('— · 50 tokens · 3 prompts · 20% active');

    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith(lowest);
  });
});
