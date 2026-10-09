import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { mockPostMessage } from '../../__tests__/setup';
import ShareContextButton from '../ShareContextButton';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShareContextButton', () => {
  it('posts a project-scoped shareContext message', () => {
    render(<ShareContextButton scope="project" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'shareContext',
      scope: 'project',
      sessionId: undefined,
    });
  });

  it('posts a session-scoped message carrying the session id', () => {
    render(<ShareContextButton scope="session" sessionId="s7" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'shareContext',
      scope: 'session',
      sessionId: 's7',
    });
  });

  it('labels each scope for what it actually does, and accepts an override', () => {
    const { rerender } = render(<ShareContextButton scope="project" />);
    expect(screen.getByRole('button')).toHaveTextContent('Share with other agents');
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringContaining('AGENTS.md'));

    rerender(<ShareContextButton scope="session" sessionId="s1" />);
    expect(screen.getByRole('button')).toHaveTextContent('Copy for another agent');
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringContaining('clipboard'));

    rerender(<ShareContextButton scope="session" sessionId="s1" label="Share this session" />);
    expect(screen.getByRole('button')).toHaveTextContent('Share this session');
  });
});
