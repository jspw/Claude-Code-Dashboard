import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeProject, makeStats } from '../../__tests__/fixtures/test-data';
import { mockPostMessage } from '../../__tests__/setup';
import Sidebar, { formatSidebarTokens, sidebarTimeAgo } from '../Sidebar';

describe('Sidebar', () => {
  it('renders grouped sections and posts dashboard/project messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    render(
      <Sidebar
        stats={makeStats({ activeSessionCount: 1, tokensTodayTotal: 1200 })}
        selectedProjectId="b"
        projects={[
          makeProject({ id: 'a', name: 'Active', isActive: true, lastActive: Date.now() }),
          makeProject({ id: 'b', name: 'Recent', isActive: false, lastActive: Date.now() - 2 * 86_400_000 }),
          makeProject({ id: 'c', name: 'Older', isActive: false, lastActive: Date.now() - 10 * 86_400_000 }),
        ]}
      />
    );

    expect(screen.getByText('1 active · 1.2k tokens today')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recent/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Older').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('View Dashboard'));
    fireEvent.click(screen.getAllByText('Active')[0]);
    fireEvent.click(screen.getAllByText('Active')[0]);
    fireEvent.click(screen.getAllByText('Recent')[0]);
    fireEvent.click(screen.getAllByText('Recent')[0]);
    fireEvent.click(screen.getAllByText('Older')[0]);
    fireEvent.click(screen.getAllByText('Older')[0]);

    fireEvent.click(screen.getAllByText('Active')[1]);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openProject', projectId: 'a' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openDashboard' });

    vi.useRealTimers();
  });

  it('formats helper values and toggles sections closed/open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    render(
      <Sidebar
        stats={makeStats({ activeSessionCount: 0, tokensTodayTotal: 2_500_000 })}
        projects={[
          makeProject({ id: 'recent', name: 'Recent Project', isActive: false, lastActive: Date.now() - 30 * 60_000 }),
          makeProject({ id: 'dup', name: 'Duplicate older copy', isActive: false, lastActive: Date.now() - 10 * 86_400_000 }),
          makeProject({ id: 'dup', name: 'Duplicate newest copy', isActive: false, lastActive: Date.now() - 9 * 86_400_000 }),
          makeProject({ id: 'never', name: 'Never', isActive: false, lastActive: 0 }),
        ]}
      />
    );

    expect(screen.getByText('0 active · 2.5M tokens today')).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();
    expect(screen.getByText('never')).toBeInTheDocument();
    expect(screen.getAllByText(/Duplicate/)).toHaveLength(1);

    fireEvent.mouseEnter(screen.getByText('View Dashboard'));
    fireEvent.mouseLeave(screen.getByText('View Dashboard'));
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.queryByRole('button', { name: /Recent Project/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByRole('button', { name: /Recent Project/ })).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText('Recent'));
    fireEvent.mouseLeave(screen.getByText('Recent'));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Recent Project/ }));
    fireEvent.mouseLeave(screen.getByRole('button', { name: /Recent Project/ }));

    expect(formatSidebarTokens(1500)).toBe('1.5k');
    expect(formatSidebarTokens(250)).toBe('250');
    expect(sidebarTimeAgo(Date.now() - 2 * 3_600_000)).toBe('2h ago');
    expect(sidebarTimeAgo(Date.now() - 9 * 86_400_000)).toBe('9d ago');

    vi.useRealTimers();
  });
});
