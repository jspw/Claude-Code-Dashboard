import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBarProvider } from '../StatusBarProvider';

describe('StatusBarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active session text and reacts to store updates', () => {
    let updateHandler: () => void = () => {};
    const stats = { totalProjects: 3, activeSessionCount: 2, tokensTodayTotal: 12500, costTodayUsd: 1.23, tokensWeekTotal: 0, costWeekUsd: 0 };
    const store = {
      getStats: vi.fn(() => stats),
      on: vi.fn((_evt, cb) => { updateHandler = cb; }),
    };

    const provider = new StatusBarProvider(store as any);
    const item = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value as any;

    expect(item.text).toContain('2 active');
    expect(item.tooltip).toContain('3 projects');
    stats.activeSessionCount = 0;
    updateHandler();
    expect(item.text).not.toContain('active ·');
    provider.dispose();
    expect(item.dispose).toHaveBeenCalledOnce();
  });
});
