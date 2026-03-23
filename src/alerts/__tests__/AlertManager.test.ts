import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertManager } from '../AlertManager';
import { DashboardStore, Project, Session } from '../../store/DashboardStore';

type GlobalStateMock = {
  get: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
type AlertStoreMock = {
  on: ReturnType<typeof vi.fn>;
  getMonthlyTokens: ReturnType<typeof vi.fn>;
  getMonthlyUsage: ReturnType<typeof vi.fn>;
  getProjects: ReturnType<typeof vi.fn>;
  getSessions: ReturnType<typeof vi.fn>;
};

describe('AlertManager', () => {
  const store: AlertStoreMock = {
    on: vi.fn(),
    getMonthlyTokens: vi.fn(),
    getMonthlyUsage: vi.fn(),
    getProjects: vi.fn(),
    getSessions: vi.fn(),
  };
  const globalState: GlobalStateMock = {
    get: vi.fn(),
    update: vi.fn(() => Promise.resolve()),
  };
  const context = {
    globalState,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T10:00:00Z'));
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, def: unknown) => {
        if (key === 'monthlyTokenBudget') return 1000;
        if (key === 'monthlyBudgetUsd') return 10;
        return def;
      }),
    } as unknown as vscode.WorkspaceConfiguration);
  });

  it('wires update listeners in the constructor', () => {
    new AlertManager(store as unknown as DashboardStore, context as unknown as vscode.ExtensionContext);
    expect(store.on).toHaveBeenCalledWith('updated', expect.any(Function));
  });

  it('shows token and cost budget warnings once per day', () => {
    let updateHandler: () => void = () => {};
    store.on.mockImplementation((_evt, cb) => { updateHandler = cb; });
    store.getMonthlyTokens.mockReturnValue(1500);
    store.getMonthlyUsage.mockReturnValue({ tokens: 1500, costUsd: 12 });
    context.globalState.get.mockReturnValue(0);

    new AlertManager(store as unknown as DashboardStore, context as unknown as vscode.ExtensionContext);
    updateHandler();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);
    expect(context.globalState.update).toHaveBeenCalledWith('lastBudgetAlert', expect.any(Number));
    expect(context.globalState.update).toHaveBeenCalledWith('lastCostBudgetExceededAlert', expect.any(Number));
  });

  it('shows weekly digest only on Mondays with activity', () => {
    const manager = new AlertManager(store as unknown as DashboardStore, context as unknown as vscode.ExtensionContext);
    context.globalState.get.mockReturnValue(0);
    store.getProjects.mockReturnValue([{ id: 'p1', name: 'Alpha' } as unknown as Project]);
    store.getSessions.mockReturnValue([{ startTime: Date.now() - 1000, totalTokens: 12000 } as unknown as Session]);

    manager.checkWeeklyDigest();

    expect(context.globalState.update).toHaveBeenCalledWith('lastWeeklyDigest', expect.any(Number));
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('12k tokens used across 1 project(s)'));
  });

  it('shows the 80% cost warning and summarizes more than three active projects', () => {
    let updateHandler: () => void = () => {};
    store.on.mockImplementation((_evt, cb) => { updateHandler = cb; });
    const manager = new AlertManager(store as unknown as DashboardStore, context as unknown as vscode.ExtensionContext);
    store.getMonthlyTokens.mockReturnValue(500);
    store.getMonthlyUsage.mockReturnValue({ tokens: 500, costUsd: 8 });
    context.globalState.get.mockImplementation((key: string) => key === 'lastCostBudget80Alert' ? 0 : 1);
    store.getProjects.mockReturnValue([
      { id: 'p1', name: 'Alpha' },
      { id: 'p2', name: 'Beta' },
      { id: 'p3', name: 'Gamma' },
      { id: 'p4', name: 'Delta' },
    ] as unknown as Project[]);
    store.getSessions.mockImplementation((projectId?: string) => {
      if (projectId) {
        return [{ startTime: Date.now() - 1000, totalTokens: 250000 }] as unknown as Session[];
      }
      return [];
    });

    updateHandler();
    manager.checkWeeklyDigest();

    expect(context.globalState.update).toHaveBeenCalledWith('lastCostBudget80Alert', expect.any(Number));
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('80% of monthly cost budget used'));
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('Projects: Alpha, Beta, Gamma +1 more.'));
  });

  it('skips alerts and digest work when budgets are disabled, under threshold, or recently shown', () => {
    let updateHandler: () => void = () => {};
    store.on.mockImplementation((_evt, cb) => { updateHandler = cb; });
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, def: unknown) => {
        if (key === 'monthlyTokenBudget') return 0;
        if (key === 'monthlyBudgetUsd') return 10;
        return def;
      }),
    } as unknown as vscode.WorkspaceConfiguration);
    store.getMonthlyTokens.mockReturnValue(500);
    store.getMonthlyUsage.mockReturnValue({ tokens: 500, costUsd: 5 });
    context.globalState.get.mockImplementation((key: string) => key === 'lastWeeklyDigest' ? Date.now() : Date.now());
    store.getProjects.mockReturnValue([{ id: 'p1', name: 'Alpha' } as unknown as Project]);
    store.getSessions.mockReturnValue([{ startTime: Date.now() - 1000, totalTokens: 0 } as unknown as Session]);

    const manager = new AlertManager(store as unknown as DashboardStore, context as unknown as vscode.ExtensionContext);
    updateHandler();
    manager.checkWeeklyDigest();

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
