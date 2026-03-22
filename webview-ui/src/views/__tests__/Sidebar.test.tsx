import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeProject, makeStats } from '../../__tests__/fixtures/test-data';
import { mockPostMessage } from '../../__tests__/setup';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  it('renders grouped sections and posts dashboard/project messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    render(
      <Sidebar
        stats={makeStats({ activeSessionCount: 1, tokensTodayTotal: 1200 })}
        projects={[
          makeProject({ id: 'a', name: 'Active', isActive: true, lastActive: Date.now() }),
          makeProject({ id: 'b', name: 'Recent', isActive: false, lastActive: Date.now() - 2 * 86_400_000 }),
          makeProject({ id: 'c', name: 'Older', isActive: false, lastActive: Date.now() - 10 * 86_400_000 }),
        ]}
      />
    );

    expect(screen.getByText('1 active · 1.2k tokens today')).toBeInTheDocument();
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
});
