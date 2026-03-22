import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    (window as any).__INITIAL_VIEW__ = 'dashboard';
    (window as any).__INITIAL_DATA__ = {
      projects: [],
      stats: {
        totalProjects: 0,
        activeSessionCount: 0,
        tokensTodayTotal: 0,
        costTodayUsd: 0,
        tokensWeekTotal: 0,
        costWeekUsd: 0,
      },
    };
  });

  it('mounts the app into the root element', async () => {
    await act(async () => {
      await import('../main');
    });
    await waitFor(() => {
      expect(document.getElementById('root')?.textContent).toContain('Claude Code Dashboard');
    });
  });
});
