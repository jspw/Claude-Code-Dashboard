import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import ActivityFeed from '../ActivityFeed';

describe('ActivityFeed', () => {
  it('renders entries with descriptions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    render(<ActivityFeed items={[{ id: '1', type: 'tool', description: 'Edited src/index.ts', timestamp: Date.now() }]} />);
    expect(screen.getByText('Edited src/index.ts')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
