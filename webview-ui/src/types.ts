export interface Project {
  id: string;
  name: string;
  path: string;
  lastActive: number;
  isActive: boolean;
  sessionCount: number;
  totalTokens: number;
  totalCostUsd: number;
  techStack: string[];
}

export interface Session {
  id: string;
  projectId: string;
  parentSessionId: string | null;
  cwd: string | null;
  isActiveSession: boolean;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  totalTokens: number;   // input + cacheCreation + output (NOT cache reads)
  costUsd: number;
  promptCount: number;
  toolCallCount: number;
  filesModified: string[];
  filesCreated: string[];
  turns: Turn[];
  sessionSummary: string | null;
  hasThinking: boolean;
  thinkingTokens: number;
  cacheHitRate: number;
  subagentCostUsd: number;
  idleTimeMs: number | null;
  activeTimeMs: number | null;
  activityRatio: number | null;
}

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: ToolCall[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeSessionCount: number;
  tokensTodayTotal: number;
  costTodayUsd: number;
  tokensWeekTotal: number;
  costWeekUsd: number;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  costUsd: number;
}

export interface ProjectUsage {
  id: string;
  name: string;
  tokens: number;
  costUsd: number;
}

export interface HeatmapCell {
  hour: number;
  day: number;
  tokens: number;
}

export interface PromptSearchResult {
  projectId: string;
  projectName: string;
  sessionId: string;
  turn: Turn;
  snippet: string;
}

export interface PatternCount {
  category: string;
  count: number;
}

export interface McpServer {
  name: string;
  command?: string;
  url?: string;
  type?: string;
}

export interface ProjectConfig {
  claudeMd: string | null;
  mcpServers: Record<string, McpServer>;
  projectSettings: Record<string, unknown>;
}

export interface ToolUsageStat {
  tool: string;
  count: number;
  percentage: number;
}

export interface HotFile {
  file: string;
  fullPath: string;
  editCount: number;
  projects: string[];
}

export interface ProjectedCost {
  dailyAvgCost: number;
  projectedMonthCost: number;
  currentMonthCost: number;
  daysElapsed: number;
  daysRemaining: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
}

export interface EfficiencyStats {
  avgTokensPerPrompt: number;
  avgToolCallsPerSession: number;
  avgSessionDurationMin: number;
  firstTurnResolutionRate: number;
  avgActiveRatio: number;
}

export interface WeeklyRecap {
  sessions: number;
  projects: number;
  tokens: number;
  costUsd: number;
  filesModified: number;
  topProject: string;
  topProjectTokens: number;
  longestSessionMin: number;
  mostUsedTool: string;
}

export interface RecentFileChange {
  file: string;
  fullPath: string;
  type: 'created' | 'modified';
  project: string;
  projectId: string;
  timestamp: number;
}

export interface ProductivityHour {
  hour: number;
  avgToolCalls: number;
  avgFilesModified: number;
  sessionCount: number;
}

export interface BudgetStatus {
  budgetUsd: number;
  spentUsd: number;
  pct: number;
}

export interface ProjectFile {
  file: string;
  fullPath: string;
  type: 'created' | 'modified' | 'both';
  editCount: number;
  lastTouched: number;
}

export interface ProjectToolCall {
  tool: string;
  input: Record<string, unknown>;
  sessionId: string;
  sessionDate: number;
  timestamp: number;
}

export interface ProjectStats {
  usageOverTime: DailyUsage[];
  toolUsage: ToolUsageStat[];
  promptPatterns: PatternCount[];
  efficiency: EfficiencyStats;
  recentToolCalls: ProjectToolCall[];
}
