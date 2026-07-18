import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';
import { formatTokens, formatCost } from '../utils/format';

export class StatusBarProvider implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private configListener: vscode.Disposable;

  constructor(private store: DashboardStore) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'claudeDashboard.openDashboard';
    this.update();
    store.on('updated', () => this.update());
    this.configListener = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeDashboard')) { this.update(); }
    });
  }

  private update() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const mode = config.get<string>('statusBar', 'compact');
    if (mode === 'off') {
      this.item.hide();
      return;
    }

    const stats = this.store.getStats();
    const tokens = formatTokens(stats.tokensTodayTotal);
    const cost = formatCost(stats.costTodayUsd);
    const active = stats.activeSessionCount;

    if (mode === 'full') {
      this.item.text = active > 0
        ? `$(pulse) Claude: ${active} active · ${tokens} · ${cost}`
        : `$(pulse) Claude: ${tokens} · ${cost}`;
    } else {
      this.item.text = active > 0 ? `$(pulse) ${active} · ${cost}` : `$(pulse) ${cost}`;
    }

    // The status bar is the always-visible budget guardrail: turn amber at 80%
    const budgetUsd = config.get<number>('monthlyBudgetUsd', 0);
    let budgetLine = '';
    if (budgetUsd > 0) {
      const { costUsd: monthUsd } = this.store.getMonthlyUsage();
      const pct = monthUsd / budgetUsd;
      this.item.backgroundColor = pct >= 0.8
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
      budgetLine = `\n\n**Budget:** ${formatCost(monthUsd)} of ${formatCost(budgetUsd)} (${Math.round(pct * 100)}%)`;
    } else {
      this.item.backgroundColor = undefined;
    }

    const tooltip = new vscode.MarkdownString(
      `**Claude Code Dashboard**\n\n` +
      `Today: ${tokens} tokens · est. ${cost}\n\n` +
      `${stats.totalProjects} projects · ${active} active session${active !== 1 ? 's' : ''}` +
      budgetLine +
      `\n\n_Click to open dashboard_`
    );
    this.item.tooltip = tooltip;
    this.item.show();
  }

  dispose() {
    this.item.dispose();
    this.configListener.dispose();
  }
}
