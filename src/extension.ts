import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { DashboardStore } from './store/DashboardStore';
import { FileWatcher } from './watchers/FileWatcher';
import { EventWatcher } from './watchers/EventWatcher';
import { HookManager } from './hooks/HookManager';
import { SidebarProvider } from './providers/SidebarProvider';
import { StatusBarProvider } from './providers/StatusBarProvider';
import { DashboardPanel } from './webviews/DashboardPanel';
import { ProjectPanel } from './webviews/ProjectPanel';
import { AlertManager } from './alerts/AlertManager';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export async function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Dashboard activating...');

  const store = new DashboardStore(CLAUDE_DIR, context.globalStorageUri.fsPath);
  const hookManager = new HookManager(CLAUDE_DIR);
  const fileWatcher = new FileWatcher(CLAUDE_DIR, store);
  const eventWatcher = new EventWatcher(CLAUDE_DIR, store);
  const sidebarProvider = new SidebarProvider(store, context);
  const statusBar = new StatusBarProvider(store);
  const alertManager = new AlertManager(store, context);

  // Register sidebar tree view
  const treeView = vscode.window.createTreeView('claudeDashboard.sidebar', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false,
  });

  // Auto-open the full dashboard when the sidebar becomes visible
  treeView.onDidChangeVisibility(e => {
    if (e.visible) {
      DashboardPanel.createOrShow(context, store);
    }
  }, null, context.subscriptions);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeDashboard.openDashboard', () => {
      DashboardPanel.createOrShow(context, store);
    }),
    vscode.commands.registerCommand('claudeDashboard.openProject', (projectId: string) => {
      ProjectPanel.createOrShow(context, store, projectId);
    }),
    vscode.commands.registerCommand('claudeDashboard.refresh', () => {
      store.refresh();
    }),
    vscode.commands.registerCommand('claudeDashboard.exportSessions', async (projectId: string, format: 'json' | 'csv') => {
      const project = store.getProject(projectId);
      if (!project) { return; }
      const sessions = store.getSessions(projectId);

      const ext = format === 'csv' ? 'csv' : 'json';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${project.name}-sessions.${ext}`),
        filters: format === 'csv' ? { 'CSV': ['csv'] } : { 'JSON': ['json'] },
      });

      if (!uri) { return; }

      let content: string;
      if (format === 'csv') {
        const header = 'id,startTime,endTime,durationMs,totalTokens,costUsd,promptCount,toolCallCount\n';
        const rows = sessions.map(s =>
          `${s.id},${s.startTime},${s.endTime ?? ''},${s.durationMs ?? ''},${s.totalTokens},${s.costUsd.toFixed(6)},${s.promptCount},${s.toolCallCount}`
        );
        content = header + rows.join('\n');
      } else {
        content = JSON.stringify(sessions, null, 2);
      }

      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
      vscode.window.showInformationMessage(`Sessions exported to ${uri.fsPath}`);
    }),
    treeView,
    statusBar,
  );

  // Start watchers
  fileWatcher.start(context);
  eventWatcher.start(context);

  // Initial data load
  await store.initialize();

  // Check weekly digest on activation
  alertManager.checkWeeklyDigest();

  // Setup hooks (ask user on first run)
  const hooksConfigured = context.globalState.get<boolean>('hooksConfigured', false);
  if (!hooksConfigured) {
    const answer = await vscode.window.showInformationMessage(
      `Claude Code Dashboard found ${store.getProjects().length} projects. Auto-configure real-time hooks for live session tracking?`,
      'Yes, configure hooks',
      'Skip'
    );
    if (answer === 'Yes, configure hooks') {
      await hookManager.injectHooks();
      await context.globalState.update('hooksConfigured', true);
      vscode.window.showInformationMessage('Claude Code Dashboard hooks configured. Real-time tracking is active.');
    }
  }

  console.log('Claude Code Dashboard activated.');
}

export function deactivate() {}
