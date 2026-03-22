import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertManager } from '../AlertManager';

describe('AlertManager', () => {
  const store = {
    on: vi.fn(),
    getMonthlyTokens: vi.fn(),
    getMonthlyUsage: vi.fn(),
    getProjects: vi.fn(),
    getSessions: vi.fn(),
  };
  const context = {
    globalState: {
      get: vi.fn(),
      update: vi.fn(() => Promise.resolve()),
    },
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
    } as any);
  });

  it('wires update listeners in the constructor', () => {
    new AlertManager(store as any, context as any);
    expect(store.on).toHaveBeenCalledWith('updated', expect.any(Function));
  });

  it('shows token and cost budget warnings once per day', () => {
    let updateHandler: () => void = () => {};
    store.on.mockImplementation((_evt, cb) => { updateHandler = cb; });
    store.getMonthlyTokens.mockReturnValue(1500);
    store.getMonthlyUsage.mockReturnValue({ tokens: 1500, costUsd: 12 });
    context.globalState.get.mockReturnValue(0);

    new AlertManager(store as any, context as any);
    updateHandler();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);
    expect(context.globalState.update).toHaveBeenCalledWith('lastBudgetAlert', expect.any(Number));
    expect(context.globalState.update).toHaveBeenCalledWith('lastCostBudgetExceededAlert', expect.any(Number));
  });

  it('shows weekly digest only on Mondays with activity', () => {
    const manager = new AlertManager(store as any, context as any);
    context.globalState.get.mockReturnValue(0);
    store.getProjects.mockReturnValue([{ id: 'p1', name: 'Alpha' }]);
    store.getSessions.mockReturnValue([{ startTime: Date.now() - 1000, totalTokens: 12000 }]);

    manager.checkWeeklyDigest();

    expect(context.globalState.update).toHaveBeenCalledWith('lastWeeklyDigest', expect.any(Number));
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('12k tokens used across 1 project(s)'));
  });
});
