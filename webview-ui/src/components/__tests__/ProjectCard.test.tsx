import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeProject } from '../../__tests__/fixtures/test-data';
import { mockPostMessage } from '../../__tests__/setup';
import ProjectCard, { formatProjectCardTokens, projectCardTimeAgo } from '../ProjectCard';

describe('ProjectCard', () => {
  it('renders active state and posts openProject', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    render(<ProjectCard project={makeProject({ id: 'p1', name: 'Alpha', isActive: true, lastActive: Date.now() - 2 * 3_600_000, totalTokens: 1500 })} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
    expect(screen.getByText('1.5k tokens')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'p1' });

    vi.useRealTimers();
  });

  it('renders inactive fallback time text', () => {
    render(<ProjectCard project={makeProject({ name: 'Beta', isActive: false, lastActive: 0 })} />);
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('formats token counts and relative times across branches', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    expect(formatProjectCardTokens(2_500_000)).toBe('2.5M');
    expect(formatProjectCardTokens(2500)).toBe('2.5k');
    expect(formatProjectCardTokens(250)).toBe('250');
    expect(projectCardTimeAgo(Date.now() - 30 * 60_000)).toBe('just now');
    expect(projectCardTimeAgo(Date.now() - 26 * 3_600_000)).toBe('1d ago');

    vi.useRealTimers();
  });
});
