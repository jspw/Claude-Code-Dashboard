import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import RecentChanges from '../RecentChanges';

describe('RecentChanges', () => {
  it('renders empty, created, modified, and unknown time states', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    const { rerender } = render(<RecentChanges data={[]} />);
    expect(screen.getByText('No recent file changes.')).toBeInTheDocument();

    rerender(<RecentChanges data={[
      { file: 'a.ts', fullPath: '/a.ts', type: 'created', project: 'Alpha', projectId: 'p1', timestamp: 0 },
      { file: 'b.ts', fullPath: '/b.ts', type: 'modified', project: 'Beta', projectId: 'p2', timestamp: Date.now() - 30_000 },
    ]} />);

    expect(screen.getByText('created')).toBeInTheDocument();
    expect(screen.getByText('modified')).toBeInTheDocument();
    expect(screen.getByText('unknown')).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
