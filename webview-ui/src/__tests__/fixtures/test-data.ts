import type {
  Project, Session, Turn, ToolCall, DashboardStats, DailyUsage,
  ProjectUsage, HeatmapCell, PatternCount, ToolUsageStat, HotFile,
  ProjectedCost, StreakData, EfficiencyStats, WeeklyRecap,
  RecentFileChange, ProductivityHour, BudgetStatus, PromptSearchResult,
  ProjectStats, ProjectFile,
} from '../../types';

let _id = 0;
const uid = () => `ui-test-${++_id}`;

export function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return { id: uid(), name: 'Read', input: { file_path: '/src/index.ts' }, ...overrides };
}

export function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: uid(), role: 'user', content: 'Hello', inputTokens: 100, outputTokens: 200,
    toolCalls: [], timestamp: Date.now(), ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    id: uid(), projectId: 'proj-1', parentSessionId: null, cwd: '/project',
    isActiveSession: false, startTime: now - 3600_000, endTime: now, durationMs: 3600_000,
    inputTokens: 10000, cacheCreationTokens: 5000, cacheReadTokens: 50000, outputTokens: 3000,
    totalTokens: 18000, costUsd: 0.25, promptCount: 5, toolCallCount: 10,
    filesModified: ['/src/index.ts'], filesCreated: [],
    turns: [makeTurn({ role: 'user', content: 'Fix bug' }), makeTurn({ role: 'assistant', content: 'Done.' })],
    sessionSummary: 'Fix bug', hasThinking: false, thinkingTokens: 0,
    cacheHitRate: 76.9, subagentCostUsd: 0,
    idleTimeMs: null, activeTimeMs: null, activityRatio: null,
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1', name: 'test-project', path: '/home/user/test-project',
    lastActive: Date.now(), isActive: false, sessionCount: 3,
    totalTokens: 50000, totalCostUsd: 1.5, techStack: ['Node.js', 'TypeScript'],
    ...overrides,
  };
}

export function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalProjects: 5, activeSessionCount: 1, tokensTodayTotal: 100000,
    costTodayUsd: 0.5, tokensWeekTotal: 500000, costWeekUsd: 2.5, ...overrides,
  };
}

export function makeDailyUsage(overrides: Partial<DailyUsage> = {}): DailyUsage {
  return { date: '1/15', tokens: 10000, costUsd: 0.1, ...overrides };
}

export function makeProjectUsage(overrides: Partial<ProjectUsage> = {}): ProjectUsage {
  return { id: 'proj-1', name: 'test-project', tokens: 50000, costUsd: 1.5, ...overrides };
}

export function makeHeatmapCell(overrides: Partial<HeatmapCell> = {}): HeatmapCell {
  return { hour: 10, day: 1, tokens: 5000, ...overrides };
}

export function makeToolUsageStat(overrides: Partial<ToolUsageStat> = {}): ToolUsageStat {
  return { tool: 'Read', count: 100, percentage: 40, ...overrides };
}

export function makeHotFile(overrides: Partial<HotFile> = {}): HotFile {
  return { file: 'index.ts', fullPath: '/src/index.ts', editCount: 15, projects: ['test-project'], ...overrides };
}

export function makeEfficiency(overrides: Partial<EfficiencyStats> = {}): EfficiencyStats {
  return {
    avgTokensPerPrompt: 5000, avgToolCallsPerSession: 8.5, avgSessionDurationMin: 25,
    firstTurnResolutionRate: 30, avgActiveRatio: 65, ...overrides,
  };
}

export function makeWeeklyRecap(overrides: Partial<WeeklyRecap> = {}): WeeklyRecap {
  return {
    sessions: 10, projects: 3, tokens: 200000, costUsd: 5.0, filesModified: 25,
    topProject: 'test-project', topProjectTokens: 100000, longestSessionMin: 45,
    mostUsedTool: 'Read', ...overrides,
  };
}

export function makeStreak(overrides: Partial<StreakData> = {}): StreakData {
  return { currentStreak: 5, longestStreak: 12, totalActiveDays: 30, ...overrides };
}

export function makeProjectedCost(overrides: Partial<ProjectedCost> = {}): ProjectedCost {
  return {
    dailyAvgCost: 0.5, projectedMonthCost: 15, currentMonthCost: 7.5,
    daysElapsed: 15, daysRemaining: 15, ...overrides,
  };
}

export function makeRecentChange(overrides: Partial<RecentFileChange> = {}): RecentFileChange {
  return {
    file: 'index.ts', fullPath: '/src/index.ts', type: 'modified',
    project: 'test-project', projectId: 'proj-1', timestamp: Date.now(), ...overrides,
  };
}

export function makePromptSearchResult(overrides: Partial<PromptSearchResult> = {}): PromptSearchResult {
  return {
    projectId: 'proj-1', projectName: 'test-project', sessionId: 'sess-1',
    turn: makeTurn({ content: 'Fix the bug in index.ts' }),
    snippet: 'Fix the bug in index.ts', ...overrides,
  };
}

export function makeBudgetStatus(overrides: Partial<BudgetStatus> = {}): BudgetStatus {
  return { budgetUsd: 50, spentUsd: 25, pct: 0.5, ...overrides };
}

export function makeProductivityHour(overrides: Partial<ProductivityHour> = {}): ProductivityHour {
  return { hour: 10, avgToolCalls: 5.2, avgFilesModified: 2.1, sessionCount: 8, ...overrides };
}
