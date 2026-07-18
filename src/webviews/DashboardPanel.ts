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
  private readonly context: vscode.ExtensionContext;
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
    this.context = context;
    this.updateContent(context, store);

    store.on('updated', () => {
      this.panel.webview.postMessage({ type: 'stateUpdate', payload: this.buildState(store) });
    });

    store.on('liveEvent', (event) => {
      this.panel.webview.postMessage({ type: 'liveEvent', payload: event });
    });

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'openProject') {
        vscode.commands.executeCommand('claudeDashboard.openProject', msg.projectId, msg.sessionId);
      }
      if (msg.type === 'getAllSessions') {
        this.panel.webview.postMessage({ type: 'allSessions', sessions: store.getAllSessionRows() });
      }
      if (msg.type === 'searchPrompts') {
        this.panel.webview.postMessage({
          type: 'promptSearchResults',
          query: msg.query,
          results: store.searchPrompts(msg.query ?? ''),
        });
      }
      if (msg.type === 'setBudget') {
        await this.promptForBudget(store);
      }
      if (msg.type === 'dismissTour') {
        await this.context.globalState.update('tourDismissed', true);
        this.panel.webview.postMessage({ type: 'stateUpdate', payload: { showTour: false } });
      }
      if (msg.type === 'refresh') {
        vscode.commands.executeCommand('claudeDashboard.refresh');
      }
    }, null, this.disposables);

    panel.onDidDispose(() => {
      DashboardPanel.currentPanel = undefined;
      this.disposables.forEach(d => d.dispose());
    }, null, this.disposables);
  }

  private async promptForBudget(store: DashboardStore) {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const current = config.get<number>('monthlyBudgetUsd', 0);
    const input = await vscode.window.showInputBox({
      title: 'Monthly cost budget (USD)',
      prompt: 'Alerts fire at 80% and 100% of this estimated spend. Enter 0 to disable.',
      value: current > 0 ? String(current) : '',
      validateInput: v => (v.trim() === '' || isNaN(Number(v)) || Number(v) < 0) ? 'Enter a non-negative number' : null,
    });
    if (input === undefined) { return; }
    await config.update('monthlyBudgetUsd', Number(input), vscode.ConfigurationTarget.Global);
    this.panel.webview.postMessage({ type: 'stateUpdate', payload: { budgetStatus: getBudgetStatus(store) } });
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
      // 90 days so the Analytics range toggle (7/30/90) filters client-side
      usageOverTime: store.getUsageOverTime(90),
      usageByProject: store.getUsageByProject(),
      heatmapData: store.getHeatmapData(),
      promptPatterns: store.getPromptPatterns(),
      toolUsage: store.getToolUsageStats(),
      hotFiles: store.getHotFiles(15),
      projectedCost: store.getProjectedCost(),
      streak: store.getStreak(),
      efficiency: store.getEfficiencyStats(),
      weeklyRecap: store.getWeeklyRecap(),
      recentChanges: store.getRecentFileChanges(7),
      productivityByHour: store.getProductivityByHour(),
      budgetStatus: getBudgetStatus(store),
      showTour: !this.context.globalState.get<boolean>('tourDismissed', false),
    };
  }
}
