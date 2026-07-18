import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeProject, makeStats } from '../../__tests__/fixtures/test-data';
import { mockPostMessage } from '../../__tests__/setup';
import Sidebar, { formatSidebarTokens, sidebarTimeAgo } from '../Sidebar';

describe('Sidebar', () => {
  it('renders grouped sections and posts dashboard/project/folder messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    const { container } = render(
      <Sidebar
        stats={makeStats({ activeSessionCount: 1, tokensTodayTotal: 1200, costTodayUsd: 0.5 })}
        selectedProjectId="b"
        projects={[
          makeProject({ id: 'a', name: 'Alpha', path: '/repos/alpha', isActive: true, lastActive: Date.now() }),
          makeProject({ id: 'b', name: 'Beta', isActive: false, lastActive: Date.now() - 2 * 86_400_000 }),
          makeProject({ id: 'c', name: 'Gamma', isActive: false, lastActive: Date.now() - 10 * 86_400_000 }),
        ]}
      />
    );

    expect(screen.getByText(/1 active · 1.2k tokens · est. \$0.500 today/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    // Selected project button carries aria-current
    const current = container.querySelector('[aria-current="page"]');
    expect(current?.textContent).toContain('Beta');

    fireEvent.click(screen.getByText('View Dashboard'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openDashboard' });

    fireEvent.click(screen.getByText('Alpha'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'a' });

    fireEvent.click(screen.getByRole('button', { name: /Reveal Alpha folder/ }));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openFolder', path: '/repos/alpha' });

    vi.useRealTimers();
  });

  it('dedupes by id, formats helpers, and toggles sections', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    render(
      <Sidebar
        stats={makeStats({ activeSessionCount: 0, tokensTodayTotal: 2_500_000, costTodayUsd: 0 })}
        projects={[
          makeProject({ id: 'recent', name: 'Recent Project', isActive: false, lastActive: Date.now() - 30 * 60_000 }),
          makeProject({ id: 'dup', name: 'Duplicate older copy', isActive: false, lastActive: Date.now() - 10 * 86_400_000 }),
          makeProject({ id: 'dup', name: 'Duplicate newest copy', isActive: false, lastActive: Date.now() - 9 * 86_400_000 }),
          makeProject({ id: 'never', name: 'Never', isActive: false, lastActive: 0 }),
        ]}
      />
    );

    expect(screen.getByText(/0 active · 2.5M tokens · est. \$0.00 today/)).toBeInTheDocument();
    // dedup keeps only one entry for id 'dup'
    expect(screen.getAllByText(/Duplicate/)).toHaveLength(1);

    // Toggle the Recent section closed then open
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.queryByText('Recent Project')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByText('Recent Project')).toBeInTheDocument();

    // Re-exported helpers still format correctly
    expect(formatSidebarTokens(1500)).toBe('1.5k');
    expect(formatSidebarTokens(250)).toBe('250');
    expect(sidebarTimeAgo(Date.now() - 2 * 3_600_000)).toBe('2h ago');
    expect(sidebarTimeAgo(Date.now() - 9 * 86_400_000)).toBe('9d ago');

    vi.useRealTimers();
  });
});
