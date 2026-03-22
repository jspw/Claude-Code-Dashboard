import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '../SidebarProvider';

describe('SidebarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the webview, pushes updates, and routes messages to commands', () => {
    let updateHandler: () => void = () => {};
    let receiveHandler: (msg: any) => void = () => {};
    const store = {
      on: vi.fn((_evt, cb) => { updateHandler = cb; }),
      getProjects: vi.fn(() => [{ id: 'p1', name: 'Alpha' }]),
      getStats: vi.fn(() => ({ totalProjects: 1, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 })),
    };
    const provider = new SidebarProvider(store as any, { extensionUri: vscode.Uri.file('/ext') } as any);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'test',
        asWebviewUri: vi.fn((u) => u),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((cb) => { receiveHandler = cb; }),
      },
    };

    provider.resolveWebviewView(webviewView as any);
    updateHandler();
    receiveHandler({ type: 'openDashboard' });
    receiveHandler({ type: 'openProject', projectId: 'p1' });

    expect(webviewView.webview.html).toContain('__INITIAL_VIEW__ = "sidebar"');
    expect(webviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openDashboard');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1');
  });
});
