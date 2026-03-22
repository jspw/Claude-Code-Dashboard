import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPanel } from '../DashboardPanel';
import { DashboardStore, LiveEvent, ProjectedCost, StreakData, EfficiencyStats, WeeklyRecap } from '../../store/DashboardStore';

type DashboardMessage = { type: 'openProject'; projectId: string };
type DashboardStoreMock = {
  on: ReturnType<typeof vi.fn>;
  getProjects: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getUsageOverTime: ReturnType<typeof vi.fn>;
  getUsageByProject: ReturnType<typeof vi.fn>;
  getHeatmapData: ReturnType<typeof vi.fn>;
  getPromptPatterns: ReturnType<typeof vi.fn>;
  getAllPrompts: ReturnType<typeof vi.fn>;
  getToolUsageStats: ReturnType<typeof vi.fn>;
  getHotFiles: ReturnType<typeof vi.fn>;
  getProjectedCost: ReturnType<typeof vi.fn>;
  getStreak: ReturnType<typeof vi.fn>;
  getEfficiencyStats: ReturnType<typeof vi.fn>;
  getWeeklyRecap: ReturnType<typeof vi.fn>;
  getRecentFileChanges: ReturnType<typeof vi.fn>;
  getProductivityByHour: ReturnType<typeof vi.fn>;
  getMonthlyUsage: ReturnType<typeof vi.fn>;
};
type WebviewPanelLike = {
  webview: {
    html: string;
    postMessage: ReturnType<typeof vi.fn>;
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
    asWebviewUri: ReturnType<typeof vi.fn>;
    cspSource: string;
  };
  reveal: ReturnType<typeof vi.fn>;
  onDidDispose: ReturnType<typeof vi.fn>;
};

describe('DashboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DashboardPanel.currentPanel = undefined;
  });

  it('creates a panel, posts updates, forwards live events, and routes openProject', () => {
    let updatedHandler: () => void = () => {};
    let liveHandler: (event: LiveEvent) => void = () => {};
    let messageHandler: (msg: DashboardMessage) => void = () => {};
    const store: DashboardStoreMock = {
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
      getProjectedCost: vi.fn(() => null as unknown as ProjectedCost),
      getStreak: vi.fn(() => null as unknown as StreakData),
      getEfficiencyStats: vi.fn(() => null as unknown as EfficiencyStats),
      getWeeklyRecap: vi.fn(() => null as unknown as WeeklyRecap),
      getRecentFileChanges: vi.fn(() => []),
      getProductivityByHour: vi.fn(() => []),
      getMonthlyUsage: vi.fn(() => ({ tokens: 0, costUsd: 2 })),
    };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({ get: vi.fn(() => 10) } as unknown as vscode.WorkspaceConfiguration);
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
    }) as unknown as vscode.WebviewPanel);

    DashboardPanel.createOrShow(
      { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext,
      store as unknown as DashboardStore,
    );
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as WebviewPanelLike;

    updatedHandler();
    liveHandler({ type: 'tool_use', timestamp: 1 });
    messageHandler({ type: 'openProject', projectId: 'p1' });

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "dashboard"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'liveEvent', payload: { type: 'tool_use', timestamp: 1 } });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1');
  });
});
