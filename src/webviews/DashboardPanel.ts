import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';
import { getWebviewContent } from './getWebviewContent';

function getBudgetStatus(store: DashboardStore): { budgetUsd: number; spentUsd: number; pct: number } | null {
  const config = vscode.workspace.getConfiguration('claudeDashboard');
  const budgetUsd = config.get<number>('monthlyBudgetUsd', 0);
  if (budgetUsd <= 0) { return null; }
  const { costUsd: spentUsd } = store.getMonthlyUsage();
  return { budgetUsd, spentUsd, pct: spentUsd / budgetUsd };
}

export class DashboardPanel {
  static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(context: vscode.ExtensionContext, store: DashboardStore) {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'claudeDashboard',
      'Claude Code Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist')] }
    );
    DashboardPanel.currentPanel = new DashboardPanel(panel, context, store);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, store: DashboardStore) {
    this.panel = panel;
    this.updateContent(context, store);

    store.on('updated', () => {
      this.panel.webview.postMessage({ type: 'stateUpdate', payload: this.buildState(store) });
    });

    store.on('liveEvent', (event) => {
      this.panel.webview.postMessage({ type: 'liveEvent', payload: event });
    });

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openProject') {
        vscode.commands.executeCommand('claudeDashboard.openProject', msg.projectId);
      }
    }, null, this.disposables);

    panel.onDidDispose(() => {
      DashboardPanel.currentPanel = undefined;
      this.disposables.forEach(d => d.dispose());
    }, null, this.disposables);
  }

  private updateContent(context: vscode.ExtensionContext, store: DashboardStore) {
    this.panel.webview.html = getWebviewContent(
      this.panel.webview,
      context.extensionUri,
      'dashboard',
      this.buildState(store)
    );
  }

  private buildState(store: DashboardStore) {
    return {
      projects: store.getProjects(),
      stats: store.getStats(),
      usageOverTime: store.getUsageOverTime(30),
      usageByProject: store.getUsageByProject(),
      heatmapData: store.getHeatmapData(),
      promptPatterns: store.getPromptPatterns(),
      allPrompts: store.getAllPrompts(),
      toolUsage: store.getToolUsageStats(),
      hotFiles: store.getHotFiles(15),
      projectedCost: store.getProjectedCost(),
      streak: store.getStreak(),
      efficiency: store.getEfficiencyStats(),
      weeklyRecap: store.getWeeklyRecap(),
      recentChanges: store.getRecentFileChanges(7),
      productivityByHour: store.getProductivityByHour(),
      budgetStatus: getBudgetStatus(store),
    };
  }
}
