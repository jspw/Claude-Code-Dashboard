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

  // Register sidebar webview view
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    'claudeDashboard.sidebar',
    sidebarProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  // Register commands
  context.subscriptions.push(
    sidebarDisposable,
    vscode.commands.registerCommand('claudeDashboard.openDashboard', () => {
      sidebarProvider.clearSelectedProject();
      DashboardPanel.createOrShow(context, store);
    }),
    vscode.commands.registerCommand('claudeDashboard.openProject', (projectId: string, sessionId?: string) => {
      sidebarProvider.setSelectedProject(projectId);
      ProjectPanel.createOrShow(context, store, projectId, sessionId);
    }),
    vscode.commands.registerCommand('claudeDashboard.refresh', () => {
      store.refresh();
    }),
    vscode.commands.registerCommand('claudeDashboard.enableLiveTracking', async () => {
      await hookManager.injectHooks(context.globalState);
      await context.globalState.update('hooksConsent', 'enabled');
      vscode.window.showInformationMessage('Live tracking enabled. Hooks were added to ~/.claude/settings.json (backup saved as settings.json.bak).');
    }),
    vscode.commands.registerCommand('claudeDashboard.disableLiveTracking', async () => {
      await hookManager.removeHooks(context.globalState);
      await context.globalState.update('hooksConsent', 'declined');
      vscode.window.showInformationMessage('Live tracking disabled. Dashboard hooks were removed from ~/.claude/settings.json.');
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
    statusBar,
  );

  // Start watchers
  fileWatcher.start(context);
  eventWatcher.start(context);

  // Initial data load
  await store.initialize();

  // Allow sidebar clicks to open the dashboard now that startup is complete.
  // resolveWebviewView may have already fired during startup (if sidebar was previously visible),
  // so any subsequent visibility change will trigger the dashboard open.
  sidebarProvider.enableAutoOpen();

  // Check weekly digest on activation
  alertManager.checkWeeklyDigest();

  // Setup hooks. Ask at most once: any explicit choice is persisted and the
  // dialog never returns. Live tracking can be toggled later via commands.
  let consent = context.globalState.get<string>('hooksConsent');
  if (!consent && context.globalState.get<boolean>('hooksConfigured', false)) {
    // Migrate the legacy flag from versions that only persisted "Yes"
    consent = 'enabled';
    await context.globalState.update('hooksConsent', 'enabled');
  }
  if (!consent) {
    const answer = await vscode.window.showInformationMessage(
      'Claude Code Dashboard can show live session activity by adding two hooks to ~/.claude/settings.json (a backup is made first). Enable live tracking?',
      'Enable',
      'Not now',
      'Never'
    );
    if (answer === 'Enable') {
      await hookManager.injectHooks(context.globalState);
      await context.globalState.update('hooksConsent', 'enabled');
      vscode.window.showInformationMessage('Live tracking enabled. Disable anytime via "Claude Code Dashboard: Disable Live Tracking".');
    } else if (answer === 'Not now') {
      await context.globalState.update('hooksConsent', 'declined');
    } else if (answer === 'Never') {
      await context.globalState.update('hooksConsent', 'never');
    }
    // Dismissing the notification without choosing leaves consent unset,
    // so the question is asked again next startup.
  } else if (consent === 'enabled' && hookManager.needsReinjection(context.globalState)) {
    await hookManager.injectHooks(context.globalState);
  }

  console.log('Claude Code Dashboard activated.');
}

export function deactivate() {}
