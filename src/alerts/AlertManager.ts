import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';
import { formatTokens, formatCost } from '../utils/format';

const OPEN_DASHBOARD = 'Open Dashboard';
const SNOOZE = 'Snooze this month';

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

  /** Budget alerts snoozed until the start of next month? */
  private isSnoozed(): boolean {
    const until = this.context.globalState.get<number>('budgetSnoozeUntil', 0);
    return Date.now() < until;
  }

  private snoozeUntilNextMonth() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    this.context.globalState.update('budgetSnoozeUntil', nextMonth);
  }

  private handleAlertAction(choice: string | undefined) {
    if (choice === OPEN_DASHBOARD) {
      vscode.commands.executeCommand('claudeDashboard.openDashboard');
    } else if (choice === SNOOZE) {
      this.snoozeUntilNextMonth();
    }
  }

  private checkTokenBudget() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const budget = config.get<number>('monthlyTokenBudget', 0);
    if (budget <= 0 || this.isSnoozed()) { return; }

    const monthlyTokens = this.store.getMonthlyTokens();
    if (monthlyTokens <= budget) { return; }

    // Check last alert time — max once per day
    const lastAlert = this.context.globalState.get<number>('lastBudgetAlert', 0);
    const now = Date.now();
    const oneDayMs = 86_400_000;
    if (now - lastAlert < oneDayMs) { return; }

    this.context.globalState.update('lastBudgetAlert', now);
    void Promise.resolve(vscode.window.showWarningMessage(
      `Monthly token budget exceeded: ${formatTokens(monthlyTokens)} of ${formatTokens(budget)} used.`,
      OPEN_DASHBOARD,
      SNOOZE
    )).then(choice => this.handleAlertAction(choice));
  }

  private checkCostBudget() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    const budgetUsd = config.get<number>('monthlyBudgetUsd', 0);
    if (budgetUsd <= 0 || this.isSnoozed()) { return; }

    const { costUsd } = this.store.getMonthlyUsage();
    const pct = costUsd / budgetUsd;
    if (pct < 0.8) { return; }

    const now = Date.now();
    const oneDayMs = 86_400_000;

    if (pct >= 1.0) {
      const lastAlert = this.context.globalState.get<number>('lastCostBudgetExceededAlert', 0);
      if (now - lastAlert < oneDayMs) { return; }
      this.context.globalState.update('lastCostBudgetExceededAlert', now);
      void Promise.resolve(vscode.window.showWarningMessage(
        `Monthly cost budget exceeded: ${formatCost(costUsd)} of ${formatCost(budgetUsd)} (estimated).`,
        OPEN_DASHBOARD,
        SNOOZE
      )).then(choice => this.handleAlertAction(choice));
    } else {
      const lastAlert = this.context.globalState.get<number>('lastCostBudget80Alert', 0);
      if (now - lastAlert < oneDayMs) { return; }
      this.context.globalState.update('lastCostBudget80Alert', now);
      void Promise.resolve(vscode.window.showWarningMessage(
        `80% of monthly cost budget used: ${formatCost(costUsd)} of ${formatCost(budgetUsd)} (estimated).`,
        OPEN_DASHBOARD,
        SNOOZE
      )).then(choice => this.handleAlertAction(choice));
    }
  }

  checkWeeklyDigest() {
    const config = vscode.workspace.getConfiguration('claudeDashboard');
    if (!config.get<boolean>('weeklyDigest', true)) { return; }

    // Fire on the first activation at least 7 days after the last digest —
    // not Mondays-only, which silently skipped users who didn't open VS Code that day.
    const lastDigest = this.context.globalState.get<number>('lastWeeklyDigest', 0);
    const sevenDaysMs = 7 * 86_400_000;
    if (Date.now() - lastDigest < sevenDaysMs) { return; }

    this.context.globalState.update('lastWeeklyDigest', Date.now());
    this.showWeeklyDigest();
  }

  private showWeeklyDigest() {
    const weekMs = 7 * 86_400_000;
    const now = Date.now();
    const projects = this.store.getProjects();

    let totalTokens = 0;
    let totalCostUsd = 0;
    let sessionCount = 0;
    let topProject: { name: string; tokens: number } | null = null;
    const perProjectTokens = new Map<string, number>();

    for (const project of projects) {
      const sessions = this.store.getSessions(project.id);
      for (const session of sessions) {
        if (session.startTime >= now - weekMs) {
          totalTokens += session.totalTokens;
          totalCostUsd += session.costUsd;
          sessionCount++;
          perProjectTokens.set(project.name, (perProjectTokens.get(project.name) ?? 0) + session.totalTokens);
        }
      }
    }

    if (totalTokens === 0) { return; }

    for (const [name, tokens] of perProjectTokens) {
      if (!topProject || tokens > topProject.tokens) { topProject = { name, tokens }; }
    }

    void Promise.resolve(vscode.window.showInformationMessage(
      `Last week: ${sessionCount} sessions · ${formatTokens(totalTokens)} tokens · est. ${formatCost(totalCostUsd)} across ${perProjectTokens.size} project${perProjectTokens.size !== 1 ? 's' : ''}${topProject ? ` · top: ${topProject.name}` : ''}.`,
      OPEN_DASHBOARD
    )).then(choice => this.handleAlertAction(choice));
  }
}
