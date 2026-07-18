import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../__tests__/helpers/render-helpers';
import { mockPostMessage } from '../../__tests__/setup';
import SessionsBrowser, { HighlightedSnippet } from '../SessionsBrowser';
import { SessionRow } from '../../types';

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1', projectId: 'p1', projectName: 'Alpha', summary: 'Fix the auth bug',
    model: 'claude-opus-4-8', pricingConfidence: 'exact', startTime: Date.now(), durationMs: 60_000,
    totalTokens: 12_000, costUsd: 0.5, subagentCostUsd: 0, hasThinking: true, promptCount: 3,
    toolCallCount: 5, isActiveSession: false, ...overrides,
  };
}

function sendAllSessions(sessions: SessionRow[]) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'allSessions', sessions } }));
  });
}

describe('SessionsBrowser', () => {
  beforeEach(() => { mockPostMessage.mockClear(); });

  it('requests sessions on mount and renders rows, then opens a session on click', async () => {
    render(<SessionsBrowser />);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'getAllSessions' });
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument();

    sendAllSessions([
      row({ id: 's1', summary: 'Fix the auth bug', projectName: 'Alpha' }),
      row({ id: 's2', summary: 'Refactor parser', projectName: 'Beta', model: 'claude-sonnet-5' }),
    ]);

    expect(screen.getByText('Fix the auth bug')).toBeInTheDocument();
    expect(screen.getByText('Refactor parser')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fix the auth bug'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'p1', sessionId: 's1' });
  });

  it('filters by project and model', () => {
    render(<SessionsBrowser />);
    sendAllSessions([
      row({ id: 's1', summary: 'Alpha opus', projectName: 'Alpha', model: 'claude-opus-4-8' }),
      row({ id: 's2', summary: 'Beta sonnet', projectName: 'Beta', model: 'claude-sonnet-5' }),
    ]);

    fireEvent.change(screen.getByDisplayValue('All projects'), { target: { value: 'Alpha' } });
    expect(screen.getByText('Alpha opus')).toBeInTheDocument();
    expect(screen.queryByText('Beta sonnet')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Alpha'), { target: { value: 'all' } });
    fireEvent.change(screen.getByDisplayValue('All models'), { target: { value: 'sonnet' } });
    expect(screen.getByText('Beta sonnet')).toBeInTheDocument();
    expect(screen.queryByText('Alpha opus')).not.toBeInTheDocument();
  });

  it('runs a debounced prompt search and highlights matches', async () => {
    vi.useFakeTimers();
    render(<SessionsBrowser />);
    sendAllSessions([row()]);

    fireEvent.change(screen.getByPlaceholderText(/Search every prompt/), { target: { value: 'auth' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'searchPrompts', query: 'auth' });

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'promptSearchResults', query: 'auth', results: [
        { projectId: 'p1', projectName: 'Alpha', sessionId: 's1', turn: {}, snippet: 'please fix the auth flow' },
      ] } }));
    });
    expect(screen.getByText('1 match for “auth”')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows an empty state when there are no sessions', () => {
    render(<SessionsBrowser />);
    sendAllSessions([]);
    expect(screen.getByText('No sessions recorded yet.')).toBeInTheDocument();
  });

  it('highlights the matched substring', () => {
    render(<HighlightedSnippet text="please fix the auth flow" query="auth" />);
    const mark = document.querySelector('mark');
    expect(mark?.textContent).toBe('auth');
  });
});
