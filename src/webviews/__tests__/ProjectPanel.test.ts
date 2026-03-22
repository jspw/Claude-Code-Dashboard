import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectPanel } from '../ProjectPanel';

describe('ProjectPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ProjectPanel as any).panels = new Map();
  });

  it('creates a project panel, strips turns, and handles export/turn requests', async () => {
    let updatedHandler: () => void = () => {};
    let messageHandler: (msg: any) => Promise<void> | void = () => {};
    const sessions = [{ id: 's1', turns: [{ id: 't1' }], startTime: 1 }];
    const store = {
      on: vi.fn((evt, cb) => { if (evt === 'updated') updatedHandler = cb; }),
      getProject: vi.fn(() => ({ id: 'p1', name: 'Alpha' })),
      getSessions: vi.fn(() => sessions),
      getSubagentSessions: vi.fn(() => [{ id: 'sub1', turns: [{ id: 'st1' }], startTime: 1 }]),
      getProjectConfig: vi.fn(() => ({ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [] })),
      getProjectStats: vi.fn(() => ({ toolUsage: [], usageOverTime: [], promptPatterns: [], efficiency: {}, recentToolCalls: [], weeklyStats: { dailyBreakdown: [] } })),
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
    }) as any);

    ProjectPanel.createOrShow({ extensionUri: vscode.Uri.file('/ext') } as any, store as any, 'p1');
    const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value as any;

    updatedHandler();
    await messageHandler({ type: 'exportSessions', format: 'csv' });
    await messageHandler({ type: 'getSessionTurns', sessionId: 's1' });

    expect(panel.webview.html).toContain('__INITIAL_VIEW__ = "project"');
    expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sessionTurns', sessionId: 's1', turns: [{ id: 't1' }] });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.exportSessions', 'p1', 'csv');
  });
});
