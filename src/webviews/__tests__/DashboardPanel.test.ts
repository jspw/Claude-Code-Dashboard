import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPanel } from '../DashboardPanel';

describe('DashboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (DashboardPanel as any).currentPanel = undefined;
  });

  it('creates a panel, posts updates, forwards live events, and routes openProject', () => {
    let updatedHandler: () => void = () => {};
    let liveHandler: (event: unknown) => void = () => {};
    let messageHandler: (msg: any) => void = () => {};
    const store = {
      on: vi.fn((evt, cb) => {
        if (evt === 'updated') updatedHandler = cb;
        if (evt === 'liveEvent') liveHandler = cb;
      }),
      getProjects: vi.fn(() => []),
      getStats: vi.fn(() => ({ totalProjects: 0, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 })),
      getUsageOverTime: vi.fn(() => []),
      getUsageByProject: vi.fn(() => []),
      getHeatmapData: vi.fn(() => []),
      getPromptPatterns: vi.fn(() => []),
      getAllPrompts: vi.fn(() => []),
      getToolUsageStats: vi.fn(() => []),
      getHotFiles: vi.fn(() => []),
      getProjectedCost: vi.fn(() => null),
      getStreak: vi.fn(() => null),
      getEfficiencyStats: vi.fn(() => null),
      getWeeklyRecap: vi.fn(() => null),
      getRecentFileChanges: vi.fn(() => []),
      getProductivityByHour: vi.fn(() => []),
      getMonthlyUsage: vi.fn(() => ({ costUsd: 2 })),
    };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({ get: vi.fn(() => 10) } as any);
    vi.mocked(vscode.window.createWebviewPanel).mockImplementation(() => ({
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((cb) => { messageHandler = cb; }),
        asWebviewUri: vi.fn((u) => u),
        cspSource: 'test',
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    }) as any);

    DashboardPanel.createOrShow({ extensionUri: vscode.Uri.file('/ext') } as any, store as any);
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as any;

    updatedHandler();
    liveHandler({ type: 'tool_use', timestamp: 1 });
    messageHandler({ type: 'openProject', projectId: 'p1' });

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "dashboard"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'liveEvent', payload: { type: 'tool_use', timestamp: 1 } });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1');
  });
});
