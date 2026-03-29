import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';
import { getWebviewContent } from '../webviews/getWebviewContent';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private selectedProjectId: string | null = null;

  constructor(private store: DashboardStore, private context: vscode.ExtensionContext) {
    store.on('updated', () => {
      if (this.view) {
        this.view.webview.postMessage({ type: 'stateUpdate', payload: this.buildState() });
      }
    });
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist')],
    };
    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context.extensionUri,
      'sidebar',
      this.buildState()
    );
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openDashboard') {
        this.clearSelectedProject();
        vscode.commands.executeCommand('claudeDashboard.openDashboard');
      }
      if (msg.type === 'openProject') {
        this.setSelectedProject(msg.projectId);
        vscode.commands.executeCommand('claudeDashboard.openProject', msg.projectId);
      }
    });
  }

  setSelectedProject(projectId: string | null) {
    this.selectedProjectId = projectId;
    this.postStateUpdate();
  }

  clearSelectedProject() {
    this.setSelectedProject(null);
  }

  private postStateUpdate() {
    if (this.view) {
      this.view.webview.postMessage({ type: 'stateUpdate', payload: this.buildState() });
    }
  }

  private buildState() {
    return {
      projects: this.store.getProjects(),
      stats: this.store.getStats(),
      selectedProjectId: this.selectedProjectId,
    };
  }
}
