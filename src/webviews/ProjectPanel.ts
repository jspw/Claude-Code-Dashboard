import * as vscode from 'vscode';
import { DashboardStore, Session } from '../store/DashboardStore';
import { getWebviewContent } from './getWebviewContent';

// Turns load on demand, and the digest and source path are backend-only.
function toWireSession({ digest: _digest, sourceFile: _sourceFile, ...session }: Session) {
  return { ...session, turns: [] };
}

export class ProjectPanel {
  private static panels: Map<string, ProjectPanel> = new Map();
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(context: vscode.ExtensionContext, store: DashboardStore, projectId: string, sessionId?: string) {
    const existing = ProjectPanel.panels.get(projectId);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      if (sessionId) {
        existing.panel.webview.postMessage({ type: 'selectSession', sessionId });
      }
      return;
    }
    const project = store.getProject(projectId);
    const title = project ? `Claude: ${project.name}` : 'Claude Project';
    const panel = vscode.window.createWebviewPanel(
      `claudeProject.${projectId}`,
      title,
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist')] }
    );
    ProjectPanel.panels.set(projectId, new ProjectPanel(panel, context, store, projectId, sessionId));
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    store: DashboardStore,
    projectId: string,
    initialSessionId?: string
  ) {
    this.panel = panel;
    this.updateContent(context, store, projectId, initialSessionId);

    const onUpdated = () => {
      this.panel.webview.postMessage({ type: 'stateUpdate', payload: this.buildState(store, projectId) });
    };
    store.on('updated', onUpdated);
    // A closed panel's webview throws on access, so a listener left behind would
    // abort the emit for every listener registered after it.
    this.disposables.push({ dispose: () => store.off('updated', onUpdated) });

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'exportSessions') {
        await vscode.commands.executeCommand('claudeDashboard.exportSessions', projectId, msg.format ?? 'json');
      }
      if (msg.type === 'shareContext') {
        await vscode.commands.executeCommand(
          'claudeDashboard.shareContext',
          projectId,
          msg.scope ?? 'project',
          msg.sessionId
        );
      }
      if (msg.type === 'getSessionTurns') {
        this.panel.webview.postMessage({
          type: 'sessionTurns',
          sessionId: msg.sessionId,
          turns: store.getSessionTurns(projectId, msg.sessionId),
        });
      }
      if (msg.type === 'openFile' && msg.path) {
        try {
          await vscode.window.showTextDocument(vscode.Uri.file(msg.path), { preview: true });
        } catch {
          vscode.window.showWarningMessage(`Could not open ${msg.path} (it may have been moved or deleted).`);
        }
      }
      if (msg.type === 'openFolder' && msg.path) {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(msg.path));
      }
    }, null, this.disposables);

    panel.onDidDispose(() => {
      ProjectPanel.panels.delete(projectId);
      this.disposables.forEach(d => d.dispose());
    }, null, this.disposables);
  }

  private updateContent(context: vscode.ExtensionContext, store: DashboardStore, projectId: string, initialSessionId?: string) {
    this.panel.webview.html = getWebviewContent(
      this.panel.webview,
      context.extensionUri,
      'project',
      // initialSessionId only ships in the initial HTML payload (deep link from
      // the Sessions tab); stateUpdate refreshes never re-select a session.
      { ...this.buildState(store, projectId), ...(initialSessionId ? { initialSessionId } : {}) }
    );
  }

  private buildState(store: DashboardStore, projectId: string) {
    // Strip turns from sessions — loaded on demand when user selects a session
    const sessions = store.getSessions(projectId).map(toWireSession);
    const subagentSessions = store.getSubagentSessions(projectId).map(toWireSession);
    return {
      project: store.getProject(projectId),
      sessions,
      subagentSessions,
      config: store.getProjectConfig(projectId),
      projectStats: store.getProjectStats(projectId),
      projectFiles: store.getProjectFiles(projectId),
      projectTodos: store.getProjectTodos(projectId),
      claudeCommits: store.getClaudeCommits(projectId),
    };
  }
}
