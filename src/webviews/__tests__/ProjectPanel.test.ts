import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectPanel } from '../ProjectPanel';
import { DashboardStore, EfficiencyStats, Project, ProjectConfig, Session } from '../../store/DashboardStore';

type ProjectMessage =
  | { type: 'exportSessions'; format?: string }
  | { type: 'getSessionTurns'; sessionId: string };
type ProjectStoreMock = {
  on: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  getSessions: ReturnType<typeof vi.fn>;
  getSubagentSessions: ReturnType<typeof vi.fn>;
  getProjectConfig: ReturnType<typeof vi.fn>;
  getProjectStats: ReturnType<typeof vi.fn>;
  getProjectFiles: ReturnType<typeof vi.fn>;
};
type ProjectStatsLike = {
  toolUsage: unknown[];
  usageOverTime: unknown[];
  promptPatterns: unknown[];
  efficiency: EfficiencyStats;
  recentToolCalls: unknown[];
  weeklyStats: {
    sessions: number;
    tokens: number;
    costUsd: number;
    dailyBreakdown: unknown[];
  };
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

describe('ProjectPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ProjectPanel as unknown as { panels: Map<string, unknown> }).panels = new Map();
  });

  it('creates a project panel, strips turns, and handles export/turn requests', async () => {
    let updatedHandler: () => void = () => {};
    let messageHandler: (msg: ProjectMessage) => Promise<void> | void = () => {};
    const sessions = [{ id: 's1', turns: [{ id: 't1' }], startTime: 1 }] as unknown as Session[];
    const store: ProjectStoreMock = {
      on: vi.fn((evt, cb) => { if (evt === 'updated') updatedHandler = cb; }),
      getProject: vi.fn(() => ({ id: 'p1', name: 'Alpha' } as unknown as Project)),
      getSessions: vi.fn(() => sessions),
      getSubagentSessions: vi.fn(() => [{ id: 'sub1', turns: [{ id: 'st1' }], startTime: 1 }] as unknown as Session[]),
      getProjectConfig: vi.fn(() => ({ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [] } as ProjectConfig)),
      getProjectStats: vi.fn(() => ({
        toolUsage: [],
        usageOverTime: [],
        promptPatterns: [],
        efficiency: {
          avgTokensPerPrompt: 0,
          avgToolCallsPerSession: 0,
          avgSessionDurationMin: 0,
          firstTurnResolutionRate: 0,
          avgActiveRatio: 0,
        } as EfficiencyStats,
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      } as ProjectStatsLike)),
      getProjectFiles: vi.fn(() => []),
    };
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

    ProjectPanel.createOrShow(
      { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext,
      store as unknown as DashboardStore,
      'p1',
    );
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as WebviewPanelLike;

    updatedHandler();
    await messageHandler({ type: 'exportSessions', format: 'csv' });
    await messageHandler({ type: 'getSessionTurns', sessionId: 's1' });

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "project"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 's1', turns: [{ id: 't1' }] });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.exportSessions', 'p1', 'csv');
  });
});
