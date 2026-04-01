import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '../SidebarProvider';
import { DashboardStats, Project, DashboardStore } from '../../store/DashboardStore';

type SidebarMessage = { type: 'openDashboard' } | { type: 'openProject'; projectId: string };
type SidebarStore = {
  on(event: 'updated', callback: () => void): void;
  getProjects(): Project[];
  getStats(): DashboardStats;
};
type ExtensionContextLike = Pick<vscode.ExtensionContext, 'extensionUri'>;
type DisposableLike = Pick<vscode.Disposable, 'dispose'>;
type WebviewLike = {
  options: vscode.WebviewOptions;
  html: string;
  cspSource: string;
  asWebviewUri: (uri: vscode.Uri) => vscode.Uri;
  postMessage: ReturnType<typeof vi.fn>;
  onDidReceiveMessage: (callback: (message: SidebarMessage) => void) => DisposableLike;
};
type WebviewViewLike = {
  webview: WebviewLike;
  visible?: boolean;
  onDidChangeVisibility?: (callback: (visible: boolean) => void) => DisposableLike;
};

describe('SidebarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the webview, pushes updates, and routes messages to commands', () => {
    let updateHandler: () => void = () => {};
    let receiveHandler: (msg: SidebarMessage) => void = () => {};
    const store: SidebarStore = {
      on: vi.fn((_evt, cb) => { updateHandler = cb; }),
      getProjects: vi.fn(() => [{
        id: 'p1',
        name: 'Alpha',
        path: '/tmp/alpha',
        lastActive: 0,
        isActive: false,
        sessionCount: 1,
        totalTokens: 0,
        totalCostUsd: 0,
        techStack: [],
      }]),
      getStats: vi.fn(() => ({ totalProjects: 1, activeSessionCount: 0, tokensTodayTotal: 0, costTodayUsd: 0, tokensWeekTotal: 0, costWeekUsd: 0 })),
    };
    const provider = new SidebarProvider(
      store as unknown as DashboardStore,
      { extensionUri: vscode.Uri.file('/ext') } as ExtensionContextLike as vscode.ExtensionContext,
    );
    const webviewView: WebviewViewLike = {
      webview: {
        options: {},
        html: '',
        cspSource: 'test',
        asWebviewUri: vi.fn((u) => u),
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn((cb) => {
          receiveHandler = cb;
          return { dispose: vi.fn() };
        }),
      },
      visible: false,
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
    };

    provider.resolveWebviewView(webviewView as unknown as vscode.WebviewView);
    updateHandler();
    receiveHandler({ type: 'openDashboard' });
    receiveHandler({ type: 'openProject', projectId: 'p1' });

    expect(webviewView.webview.html).toContain('__INITIAL_VIEW__ = "sidebar"');
    expect(webviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stateUpdate' }));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openDashboard');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('claudeDashboard.openProject', 'p1');
  });
});
