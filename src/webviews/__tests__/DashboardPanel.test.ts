import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPanel } from '../DashboardPanel';
import { DashboardStore, LiveEvent, ProjectedCost, StreakData, EfficiencyStats, WeeklyRecap } from '../../store/DashboardStore';

type DashboardMessage =
  | { type: 'openProject'; projectId: string; sessionId?: string }
  | { type: 'getAllSessions' }
  | { type: 'searchPrompts'; query?: string }
  | { type: 'setBudget' }
  | { type: 'dismissTour' }
  | { type: 'refresh' };
type DashboardStoreMock = {
  on: ReturnType<typeof vi.fn>;
  getProjects: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getUsageOverTime: ReturnType<typeof vi.fn>;
  getUsageByProject: ReturnType<typeof vi.fn>;
  getHeatmapData: ReturnType<typeof vi.fn>;
  getPromptPatterns: ReturnType<typeof vi.fn>;
  getToolUsageStats: ReturnType<typeof vi.fn>;
  getHotFiles: ReturnType<typeof vi.fn>;
  getProjectedCost: ReturnType<typeof vi.fn>;
  getStreak: ReturnType<typeof vi.fn>;
  getEfficiencyStats: ReturnType<typeof vi.fn>;
  getWeeklyRecap: ReturnType<typeof vi.fn>;
  getRecentFileChanges: ReturnType<typeof vi.fn>;
  getProductivityByHour: ReturnType<typeof vi.fn>;
  getMonthlyUsage: ReturnType<typeof vi.fn>;
  getAllSessionRows: ReturnType<typeof vi.fn>;
  searchPrompts: ReturnType<typeof vi.fn>;
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

function createStore(overrides: Partial<DashboardStoreMock> = {}): DashboardStoreMock {
  return {
    on: vi.fn(),
    getProjects: vi.fn(() => []),
    getStats: vi.fn(() => ({ totalProjects: 0, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 })),
    getUsageOverTime: vi.fn(() => []),
    getUsageByProject: vi.fn(() => []),
    getHeatmapData: vi.fn(() => []),
    getPromptPatterns: vi.fn(() => []),
    getToolUsageStats: vi.fn(() => []),
    getHotFiles: vi.fn(() => []),
    getProjectedCost: vi.fn(() => null as unknown as ProjectedCost),
    getStreak: vi.fn(() => null as unknown as StreakData),
    getEfficiencyStats: vi.fn(() => null as unknown as EfficiencyStats),
    getWeeklyRecap: vi.fn(() => null as unknown as WeeklyRecap),
    getRecentFileChanges: vi.fn(() => []),
    getProductivityByHour: vi.fn(() => []),
    getMonthlyUsage: vi.fn(() => ({ tokens: 0, costUsd: 2 })),
    getAllSessionRows: vi.fn(() => [{ id: 's1', projectId: 'p1', projectName: 'Alpha' }]),
    searchPrompts: vi.fn(() => [{ sessionId: 's1', snippet: 'fix auth' }]),
    ...overrides,
  };
}

describe('DashboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DashboardPanel.currentPanel = undefined;
  });

  it('creates a panel, posts updates, forwards live events, and routes openProject', () => {
    let updatedHandler: () => void = () => {};
    let liveHandler: (event: LiveEvent) => void = () => {};
    let messageHandler: (msg: DashboardMessage) => void = () => {};
    const store = createStore({
      on: vi.fn((evt, cb) => {
        if (evt === 'updated') updatedHandler = cb;
        if (evt === 'liveEvent') liveHandler = cb;
      }),
    });
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

    const context = {
      extensionUri: vscode.Uri.file('/ext'),
      globalState: { get: vi.fn(() => false), update: vi.fn(() => Promise.resolve()) },
    } as unknown as vscode.ExtensionContext;
    DashboardPanel.createOrShow(context, store as unknown as DashboardStore);
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as WebviewPanelLike;

    updatedHandler();
    liveHandler({ type: 'tool_use', timestamp: 1 });
    messageHandler({ type: 'openProject', projectId: 'p1' });
    messageHandler({ type: 'openProject', projectId: 'p1', sessionId: 's9' });
    messageHandler({ type: 'getAllSessions' } as unknown as DashboardMessage);
    messageHandler({ type: 'searchPrompts', query: 'auth' } as unknown as DashboardMessage);

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "dashboard"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'liveEvent', payload: { type: 'tool_use', timestamp: 1 } });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1', undefined);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1', 's9');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'allSessions' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'promptSearchResults', query: 'auth' }));
    expect(store.searchPrompts).toHaveBeenCalledWith('auth');
  });

  it('reuses the panel, handles dashboard controls, and disposes subscriptions', async () => {
    let messageHandler: (msg: DashboardMessage) => Promise<void> | void = () => {};
    let disposeHandler: () => void = () => {};
    const receiveDisposable = { dispose: vi.fn() };
    const panelDisposable = { dispose: vi.fn() };
    const panel = {
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((
          cb: (msg: DashboardMessage) => Promise<void> | void,
          _thisArg: unknown,
          disposables: vscode.Disposable[],
        ) => {
          messageHandler = cb;
          disposables.push(receiveDisposable);
          return receiveDisposable;
        }),
        asWebviewUri: vi.fn((u) => u),
        cspSource: 'test',
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn((
        cb: () => void,
        _thisArg: unknown,
        disposables: vscode.Disposable[],
      ) => {
        disposeHandler = cb;
        disposables.push(panelDisposable);
        return panelDisposable;
      }),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);

    let budget = 25;
    const config = {
      get: vi.fn(() => budget),
      update: vi.fn(async (_key: string, value: number) => { budget = value; }),
    };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as unknown as vscode.WorkspaceConfiguration);
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('50');

    const updateGlobalState = vi.fn(() => Promise.resolve());
    const context = {
      extensionUri: vscode.Uri.file('/ext'),
      globalState: { get: vi.fn(() => true), update: updateGlobalState },
    } as unknown as vscode.ExtensionContext;
    const store = createStore();

    DashboardPanel.createOrShow(context, store as unknown as DashboardStore);
    DashboardPanel.createOrShow(context, store as unknown as DashboardStore);
    await messageHandler({ type: 'setBudget' });
    await messageHandler({ type: 'searchPrompts' });
    await messageHandler({ type: 'dismissTour' });
    await messageHandler({ type: 'refresh' });
    disposeHandler();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ value: '25' }));
    expect(config.update).toHaveBeenCalledWith('monthlyBudgetUsd', 50, vscode.ConfigurationTarget.Global);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'stateUpdate',
      payload: { budgetStatus: { budgetUsd: 50, spentUsd: 2, pct: 0.04 } },
    });
    expect(store.searchPrompts).toHaveBeenCalledWith('');
    expect(updateGlobalState).toHaveBeenCalledWith('tourDismissed', true);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'stateUpdate', payload: { showTour: false } });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.refresh');
    expect(receiveDisposable.dispose).toHaveBeenCalledOnce();
    expect(panelDisposable.dispose).toHaveBeenCalledOnce();
    expect(DashboardPanel.currentPanel).toBeUndefined();
  });

  it('supports a disabled budget, validates input, and leaves it unchanged when cancelled', async () => {
    let messageHandler: (msg: DashboardMessage) => Promise<void> | void = () => {};
    const panel = {
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((cb) => { messageHandler = cb; }),
        asWebviewUri: vi.fn((u) => u),
        cspSource: 'test',
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as unknown as vscode.WebviewPanel);
    const config = { get: vi.fn(() => 0), update: vi.fn() };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as unknown as vscode.WorkspaceConfiguration);
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
    const store = createStore();
    const context = {
      extensionUri: vscode.Uri.file('/ext'),
      globalState: { get: vi.fn(() => false), update: vi.fn() },
    } as unknown as vscode.ExtensionContext;

    DashboardPanel.createOrShow(context, store as unknown as DashboardStore);
    await messageHandler({ type: 'setBudget' });

    const inputOptions = vi.mocked(vscode.window.showInputBox).mock.calls[0][0];
    if (!inputOptions) { throw new Error('Expected budget input options'); }
    expect(inputOptions.value).toBe('');
    expect(inputOptions.validateInput?.('')).toBe('Enter a non-negative number');
    expect(inputOptions.validateInput?.('not-a-number')).toBe('Enter a non-negative number');
    expect(inputOptions.validateInput?.('-1')).toBe('Enter a non-negative number');
    expect(inputOptions.validateInput?.('0')).toBeNull();
    expect(config.update).not.toHaveBeenCalled();
    expect(store.getMonthlyUsage).not.toHaveBeenCalled();
  });
});
