import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBarProvider } from '../StatusBarProvider';
import { DashboardStats, DashboardStore } from '../../store/DashboardStore';

type StatusBarStore = {
  getStats(): DashboardStats;
  getMonthlyUsage(): { tokens: number; costUsd: number };
  on(event: 'updated', callback: () => void): void;
};
type StatusBarItemLike = Pick<vscode.StatusBarItem, 'text' | 'dispose' | 'backgroundColor'> & {
  tooltip: { value: string };
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
};

function mockConfig(values: Record<string, unknown>) {
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: vi.fn((key: string, def: unknown) => values[key] ?? def),
  } as unknown as vscode.WorkspaceConfiguration);
}

function makeStore(stats: DashboardStats, monthUsd = 0): StatusBarStore & { updateHandler: () => void } {
  const holder = {
    updateHandler: (() => {}) as () => void,
    getStats: vi.fn(() => stats),
    getMonthlyUsage: vi.fn(() => ({ tokens: 0, costUsd: monthUsd })),
    on: vi.fn((_evt: string, cb: () => void) => { holder.updateHandler = cb; }),
  };
  return holder;
}

describe('StatusBarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders compact text by default and reacts to store updates', () => {
    mockConfig({});
    const stats = { totalProjects: 3, activeSessionCount: 2, tokensTodayTotal: 12500, costTodayUsd: 1.23, tokensWeekTotal: 0, costWeekUsd: 0 };
    const store = makeStore(stats);

    const provider = new StatusBarProvider(store as unknown as DashboardStore);
    const item = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value as StatusBarItemLike;

    expect(item.text).toBe('$(pulse) 2 · $1.23');
    expect(item.tooltip.value).toContain('3 projects');
    stats.activeSessionCount = 0;
    store.updateHandler();
    expect(item.text).toBe('$(pulse) $1.23');
    provider.dispose();
    expect(item.dispose).toHaveBeenCalledOnce();
  });

  it('renders the full format when configured', () => {
    mockConfig({ statusBar: 'full' });
    const store = makeStore({ totalProjects: 1, activeSessionCount: 1, tokensTodayTotal: 2000, costTodayUsd: 0.5, tokensWeekTotal: 0, costWeekUsd: 0 });

    new StatusBarProvider(store as unknown as DashboardStore);
    const item = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value as StatusBarItemLike;

    expect(item.text).toBe('$(pulse) Claude: 1 active · 2.0k · $0.500');
  });

  it('hides the item when set to off', () => {
    mockConfig({ statusBar: 'off' });
    const store = makeStore({ totalProjects: 0, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 });

    new StatusBarProvider(store as unknown as DashboardStore);
    const item = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value as StatusBarItemLike;

    expect(item.hide).toHaveBeenCalled();
    expect(item.show).not.toHaveBeenCalled();
  });

  it('turns amber and reports budget in the tooltip at 80%+ spend', () => {
    mockConfig({ monthlyBudgetUsd: 10 });
    const store = makeStore({ totalProjects: 2, activeSessionCount: 0, tokensTodayTotal: 100, costTodayUsd: 0.1, tokensWeekTotal: 0, costWeekUsd: 0 }, 9);

    new StatusBarProvider(store as unknown as DashboardStore);
    const item = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value as StatusBarItemLike;

    expect(item.backgroundColor).toEqual(new vscode.ThemeColor('statusBarItem.warningBackground'));
    expect(item.tooltip.value).toContain('$9.00 of $10.00 (90%)');
  });
});
