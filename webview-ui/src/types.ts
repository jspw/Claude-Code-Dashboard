// What a running session is doing, from Claude Code's ~/.claude/sessions files.
export type LiveStatus = 'busy' | 'waiting' | 'idle';

export interface Project {
  id: string;
  name: string;
  path: string;
  lastActive: number;
  isActive: boolean;
  liveStatus?: LiveStatus | null;  // its most pressing live session: waiting, then busy, then idle
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
  liveStatus?: LiveStatus | null;
  waitingFor?: string | null;   // set while waiting, e.g. "permission prompt"
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
  model: string | null;           // raw detected model ID (e.g. 'claude-opus-4-8')
  pricingConfidence?: 'exact' | 'fallback'; // 'fallback' = unknown model, priced at Sonnet rates
}

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: ToolCall[];
  timestamp: number;
  attachments?: TurnAttachment[];  // files the user @-tagged in this prompt
  thinking?: string;    // extended-thinking text emitted before this turn's content
  isCompactSummary?: boolean;  // the summary Claude Code writes after compacting the conversation
  usage?: TurnUsage;    // the API call behind this turn; only on the first entry of each response
}

/** One API call's tokens and cost. Their sum is the session's usage. */
export interface TurnUsage {
  input: number;        // fresh, uncached input tokens
  cacheWrite: number;
  cacheWrite1h: number; // of cacheWrite, tokens written to the 1-hour cache (the rest went to the 5-minute one)
  cacheRead: number;
  output: number;
  costUsd: number;
  model: string | null;
  compacted?: boolean;  // Claude Code compacted the conversation right before this call
}

export interface TurnAttachment {
  path: string;         // absolute file path
  displayPath: string;  // project-relative path as shown in the prompt
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  mcpServer?: string;   // set if tool name matches mcp__<server>__<tool>
  answers?: Record<string, QuestionAnswer>;   // AskUserQuestion: question text → the user's answer
}

export interface QuestionAnswer {
  answer: string;       // chosen label(s), comma-joined for multi-select, or the user's own text
  notes?: string;
  preview?: string;     // preview of the chosen option, when the question had previews
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

/** Lightweight cross-project session row for the dashboard Sessions tab. */
export interface SessionRow {
  id: string;
  projectId: string;
  projectName: string;
  summary: string | null;
  model: string | null;
  pricingConfidence?: 'exact' | 'fallback';
  startTime: number;
  durationMs: number | null;
  totalTokens: number;
  costUsd: number;
  subagentCostUsd: number;
  hasThinking: boolean;
  promptCount: number;
  toolCallCount: number;
  isActiveSession: boolean;
  liveStatus?: LiveStatus | null;
  waitingFor?: string | null;
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
  toolCallCount: number;   // total calls across all project sessions (0 if unused)
}

export interface MemoryFile {
  fileName: string;
  name: string;
  description: string;
  type: string;       // 'user' | 'feedback' | 'project' | 'reference' | 'unknown'
  content: string;
}

export interface ProjectMemory {
  index: string | null;   // MEMORY.md contents
  files: MemoryFile[];
}

export interface PlanFile {
  fileName: string;
  name: string;
  description: string;
  content: string;
}

export interface HookConfig {
  event: string;
  matcher?: string;
  command: string;
}

export interface ProjectConfig {
  claudeMd: string | null;
  mcpServers: Record<string, McpServer>;
  projectSettings: Record<string, unknown>;
  commands: { name: string; content: string }[];
  plans: PlanFile[];
  memory: ProjectMemory;
  hooks: HookConfig[];
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

export interface WeeklyProjectStats {
  sessions: number;
  tokens: number;
  costUsd: number;
  dailyBreakdown: { date: string; tokens: number; costUsd: number; sessions: number }[];
}

export interface ClaudeCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: number;
  subject: string;
  filesChanged: number;
}

export interface SessionTodoSnapshot {
  sessionId: string;
  sessionDate: number;
  sessionSummary: string | null;
  todos: { content: string; status: string }[];
  timestamp: number;
}

export interface ProjectStats {
  usageOverTime: DailyUsage[];
  toolUsage: ToolUsageStat[];
  promptPatterns: PatternCount[];
  efficiency: EfficiencyStats;
  recentToolCalls: ProjectToolCall[];
  weeklyStats: WeeklyProjectStats;
}
