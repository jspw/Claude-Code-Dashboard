import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';

export class AlertManager {
  private store: DashboardStore;
  private context: vscode.ExtensionContext;

  constructor(store: DashboardStore, context: vscode.ExtensionContext) {
    this.store = store;
    this.context = context;

    // Listen for store updates to check budgets
    store.on('updated', () => {
      this.checkTokenBudget();
      this.checkCostBudget();
    });
  }

  private checkTokenBudget() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const budget = config.get<number>('monthlyTokenBudget', 0);
    if (budget <= 0) { return; }

    const monthlyTokens = this.store.getMonthlyTokens();
    if (monthlyTokens <= budget) { return; }

    // Check last alert time — max once per day
    const lastAlert = this.context.globalState.get<number>('lastBudgetAlert', 0);
    const now = Date.now();
    const oneDayMs = 86_400_000;
    if (now - lastAlert < oneDayMs) { return; }

    this.context.globalState.update('lastBudgetAlert', now);
    const used = (monthlyTokens / 1_000_000).toFixed(2);
    const limit = (budget / 1_000_000).toFixed(2);
    vscode.window.showWarningMessage(
      `Claude Code Dashboard: Monthly token budget exceeded! Used ${used}M of ${limit}M tokens this month.`
    );
  }

  private checkCostBudget() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const budgetUsd = config.get<number>('monthlyBudgetUsd', 0);
    if (budgetUsd <= 0) { return; }

    const { costUsd } = this.store.getMonthlyUsage();
    const pct = costUsd / budgetUsd;
    if (pct < 0.8) { return; }

    const now = Date.now();
    const oneDayMs = 86_400_000;

    if (pct >= 1.0) {
      const lastAlert = this.context.globalState.get<number>('lastCostBudgetExceededAlert', 0);
      if (now - lastAlert < oneDayMs) { return; }
      this.context.globalState.update('lastCostBudgetExceededAlert', now);
      vscode.window.showWarningMessage(
        `Claude Code Dashboard: Monthly cost budget exceeded! Spent $${costUsd.toFixed(2)} of $${budgetUsd.toFixed(2)} budget.`
      );
    } else {
      const lastAlert = this.context.globalState.get<number>('lastCostBudget80Alert', 0);
      if (now - lastAlert < oneDayMs) { return; }
      this.context.globalState.update('lastCostBudget80Alert', now);
      vscode.window.showWarningMessage(
        `Claude Code Dashboard: 80% of monthly cost budget used. Spent $${costUsd.toFixed(2)} of $${budgetUsd.toFixed(2)}.`
      );
    }
  }

  checkWeeklyDigest() {
    const now = new Date();
    // Only run on Mondays
    if (now.getDay() !== 1) { return; }

    const lastDigest = this.context.globalState.get<number>('lastWeeklyDigest', 0);
    const sixDaysMs = 6 * 86_400_000;
    if (Date.now() - lastDigest < sixDaysMs) { return; }

    this.context.globalState.update('lastWeeklyDigest', Date.now());
    this.showWeeklyDigest();
  }

  private showWeeklyDigest() {
    const weekMs = 7 * 86_400_000;
    const now = Date.now();
    const projects = this.store.getProjects();

    let totalTokens = 0;
    const activeProjects = new Set<string>();

    for (const project of projects) {
      const sessions = this.store.getSessions(project.id);
      for (const session of sessions) {
        if (session.startTime >= now - weekMs) {
          totalTokens += session.totalTokens;
          activeProjects.add(project.name);
        }
      }
    }

    if (totalTokens === 0) { return; }

    const tokensStr = totalTokens >= 1_000_000
      ? `${(totalTokens / 1_000_000).toFixed(1)}M`
      : `${(totalTokens / 1_000).toFixed(0)}k`;

    const projectList = Array.from(activeProjects).slice(0, 3).join(', ');
    const moreProjects = activeProjects.size > 3 ? ` +${activeProjects.size - 3} more` : '';

    vscode.window.showInformationMessage(
      `Claude Code Dashboard weekly digest: ${tokensStr} tokens used across ${activeProjects.size} project(s) last week. Projects: ${projectList}${moreProjects}.`
    );
  }
}
