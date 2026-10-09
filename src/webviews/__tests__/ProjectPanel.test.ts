import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectPanel } from '../ProjectPanel';
import { DashboardStore, EfficiencyStats, Project, ProjectConfig, Session } from '../../store/DashboardStore';

type ProjectMessage =
  | { type: 'exportSessions'; format?: string }
  | { type: 'getSessionTurns'; sessionId: string }
  | { type: 'shareContext'; scope?: string; sessionId?: string };
type ProjectStoreMock = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  getSessions: ReturnType<typeof vi.fn>;
  getSubagentSessions: ReturnType<typeof vi.fn>;
  getProjectConfig: ReturnType<typeof vi.fn>;
  getProjectStats: ReturnType<typeof vi.fn>;
  getProjectFiles: ReturnType<typeof vi.fn>;
  getProjectTodos: ReturnType<typeof vi.fn>;
  getClaudeCommits: ReturnType<typeof vi.fn>;
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
      off: vi.fn(),
      getProject: vi.fn(() => ({ id: 'p1', name: 'Alpha' } as unknown as Project)),
      getSessions: vi.fn(() => sessions),
      getSubagentSessions: vi.fn(() => [{ id: 'sub1', turns: [{ id: 'st1' }], startTime: 1 }] as unknown as Session[]),
      getProjectConfig: vi.fn(() => ({ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [], plans: [], memory: { index: null, files: [] }, hooks: [] } as ProjectConfig)),
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
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
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
    await messageHandler({ type: 'shareContext', scope: 'session', sessionId: 's1' });

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "project"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 's1', turns: [{ id: 't1' }] });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.exportSessions', 'p1', 'csv');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.shareContext', 'p1', 'session', 's1');
  });

  it('reuses an existing panel, falls back to a generic title, and handles missing sessions', async () => {
    let messageHandler: (msg: ProjectMessage) => Promise<void> | void = () => {};
    let disposeHandler: () => void = () => {};
    const reveal = vi.fn();

    const store: ProjectStoreMock = {
      on: vi.fn(),
      off: vi.fn(),
      getProject: vi.fn(() => undefined),
      getSessions: vi.fn(() => []),
      getSubagentSessions: vi.fn(() => []),
      getProjectConfig: vi.fn(() => ({ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [], plans: [], memory: { index: null, files: [] }, hooks: [] } as ProjectConfig)),
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
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
    };

    vi.mocked(vscode.window.createWebviewPanel).mockImplementation(() => ({
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((cb) => { messageHandler = cb; }),
        asWebviewUri: vi.fn((u) => u),
        cspSource: 'test',
      },
      reveal,
      onDidDispose: vi.fn((cb) => { disposeHandler = cb; }),
    }) as unknown as vscode.WebviewPanel);

    const context = { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext;

    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'missing');
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as WebviewPanelLike;
    await messageHandler({ type: 'exportSessions' });
    await messageHandler({ type: 'getSessionTurns', sessionId: 'unknown' });
    await messageHandler({ type: 'shareContext' });
    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'missing');
    disposeHandler();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'claudeProject.missing',
      'Claude Project',
      vscode.ViewColumn.One,
      expect.anything(),
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.exportSessions', 'missing', 'json');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.shareContext', 'missing', 'project', undefined);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 'unknown', turns: [] });
    expect(reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
  });

  it('serves turns for subagent sessions as well as main ones', async () => {
    let messageHandler: (msg: ProjectMessage) => Promise<void> | void = () => {};
    const subagent = { id: 'sub1', turns: [{ id: 't9' }], startTime: 1 };
    const store = {
      on: vi.fn(),
      off: vi.fn(),
      getProject: vi.fn(() => undefined),
      getSessions: vi.fn(() => []),
      getSubagentSessions: vi.fn(() => [subagent]),
      getProjectConfig: vi.fn(() => ({})),
      getProjectStats: vi.fn(() => ({})),
      getProjectFiles: vi.fn(() => []),
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
    };
    const panel = {
      webview: { html: '', postMessage: vi.fn(), onDidReceiveMessage: vi.fn((cb) => { messageHandler = cb; }), asWebviewUri: vi.fn((u) => u), cspSource: 'test' },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);
    const context = { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext;

    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'p1');
    await messageHandler({ type: 'getSessionTurns', sessionId: 'sub1' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 'sub1', turns: [{ id: 't9' }] });
  });

  it('stops listening to the store once the panel is closed', () => {
    const emitter = new EventEmitter();
    let disposeHandler: () => void = () => {};
    const store = {
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      getProject: vi.fn(() => undefined),
      getSessions: vi.fn(() => []),
      getSubagentSessions: vi.fn(() => []),
      getProjectConfig: vi.fn(() => ({})),
      getProjectStats: vi.fn(() => ({})),
      getProjectFiles: vi.fn(() => []),
      getProjectTodos: vi.fn(() => []),
      getClaudeCommits: vi.fn(() => []),
    };
    const panel = {
      webview: { html: '', postMessage: vi.fn(), onDidReceiveMessage: vi.fn(), asWebviewUri: vi.fn((u) => u), cspSource: 'test' },
      reveal: vi.fn(),
      onDidDispose: vi.fn((cb) => { disposeHandler = cb; }),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);
    const context = { extensionUri: vscode.Uri.file('/ext') } as Pick<vscode.ExtensionContext, 'extensionUri'> as vscode.ExtensionContext;

    ProjectPanel.createOrShow(context, store as unknown as DashboardStore, 'p1');
    disposeHandler();
    // VS Code throws on any access to a closed panel's webview; a listener left
    // behind would abort the emit for every listener registered after it.
    Object.defineProperty(panel, 'webview', { get: () => { throw new Error('Webview is disposed'); } });

    expect(() => emitter.emit('updated')).not.toThrow();
    expect(emitter.listenerCount('updated')).toBe(0);
  });
});
