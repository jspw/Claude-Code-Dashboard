import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';
import { getWebviewContent } from '../webviews/getWebviewContent';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private selectedProjectId: string | null = null;
  private _autoOpenEnabled = false;

  constructor(private store: DashboardStore, private context: vscode.ExtensionContext) {
    store.on('updated', () => {
      if (this.view) {
        this.view.webview.postMessage({ type: 'stateUpdate', payload: this.buildState() });
      }
    });
  }

  /** Call this after store initialization to enable auto-opening the dashboard on sidebar show. */
  enableAutoOpen() {
    this._autoOpenEnabled = true;
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

    // If autoOpen is already enabled when resolveWebviewView fires, the user clicked the icon
    // after startup (sidebar wasn't previously visible). Open the dashboard.
    if (this._autoOpenEnabled) {
      vscode.commands.executeCommand('claudeDashboard.openDashboard');
    }

    // Open dashboard whenever the user makes the sidebar visible after startup.
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._autoOpenEnabled) {
        vscode.commands.executeCommand('claudeDashboard.openDashboard');
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
