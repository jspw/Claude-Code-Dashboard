import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';

export class StatusBarProvider implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor(private store: DashboardStore) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'claudeDashboard.openDashboard';
    this.update();
    store.on('updated', () => this.update());
    this.item.show();
  }

  private update() {
    const stats = this.store.getStats();
    const tokens = formatTokens(stats.tokensTodayTotal);
    const cost = `$${stats.costTodayUsd.toFixed(2)}`;
    if (stats.activeSessionCount > 0) {
      this.item.text = `$(pulse) Claude: ${stats.activeSessionCount} active · ${tokens} · ${cost}`;
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = `$(pulse) Claude: ${tokens} · ${cost}`;
      this.item.backgroundColor = undefined;
    }
    this.item.tooltip = `Claude Code Dashboard\n${stats.totalProjects} projects · ${stats.activeSessionCount} active sessions\nClick to open dashboard`;
  }

  dispose() { this.item.dispose(); }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}k`; }
  return `${n}`;
}
