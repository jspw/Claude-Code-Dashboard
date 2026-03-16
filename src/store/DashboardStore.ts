import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { SessionParser } from '../parsers/SessionParser';
import { SettingsParser } from '../parsers/SettingsParser';

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

export interface Project {
  id: string;           // url-encoded path used by claude
  name: string;         // human-readable folder name
  path: string;         // absolute path on disk
  lastActive: number;   // unix timestamp ms
  isActive: boolean;    // has an active session right now
  sessionCount: number;
  totalTokens: number;
  totalCostUsd: number;
  techStack: string[];
}

export interface Session {
  id: string;
  projectId: string;
  parentSessionId: string | null;  // set for subagent sessions, null for top-level
  cwd: string | null;
  isActiveSession: boolean;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  inputTokens: number;        // fresh uncached input tokens
  cacheCreationTokens: number; // tokens written to cache
  cacheReadTokens: number;    // tokens read from cache (cheap, excluded from totalTokens)
  outputTokens: number;
  totalTokens: number;        // input + cacheCreation + output (NOT cache reads)
  costUsd: number;            // accurate cost using all 4 token types
  promptCount: number;
  toolCallCount: number;
  filesModified: string[];
  filesCreated: string[];
  turns: Turn[];
  sessionSummary: string | null;  // first user prompt as preview
  hasThinking: boolean;           // session used extended thinking
  thinkingTokens: number;         // tokens consumed by thinking blocks
  cacheHitRate: number;           // cacheRead / (input + cacheCreation + cacheRead) * 100
  subagentCostUsd: number;        // cost attributed to child subagent sessions
  idleTimeMs: number | null;      // sum of gaps >5min between assistant→user turns
  activeTimeMs: number | null;    // durationMs - idleTimeMs
  activityRatio: number | null;   // activeTimeMs / durationMs * 100
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
  mcpServer?: string;   // set if tool name matches mcp__<server>__<tool>
}

export interface LiveEvent {
  type: 'tool_use' | 'session_stop' | 'notification';
  tool?: string;
  projectId?: string;
  sessionId?: string;
  timestamp: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeSessionCount: number;
  tokensTodayTotal: number;
  costTodayUsd: number;
  tokensWeekTotal: number;
  costWeekUsd: number;
}

export interface PromptSearchResult {
  projectId: string;
  projectName: string;
  sessionId: string;
  turn: Turn;
  snippet: string; // highlighted match context
}

export interface McpServer {
  name: string;
  command?: string;
  url?: string;
  type?: string;
  toolCallCount: number;   // total calls across all project sessions (0 if unused)
}

export interface ProjectConfig {
  claudeMd: string | null;
  mcpServers: Record<string, McpServer>;
  projectSettings: Record<string, unknown>;
  commands: { name: string; content: string }[];
}

const CACHE_VERSION = 2;

interface CacheEntry {
  cachedAt: number;
  project: Project;
  sessions: Session[];
  subagentSessions: Session[];
}

interface CacheFile {
  version: number;
  entries: Record<string, CacheEntry>;
}

export class DashboardStore extends EventEmitter {
  private claudeDir: string;
  private cacheDir: string | null;
  private cacheData: CacheFile = { version: CACHE_VERSION, entries: {} };
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, Session[]> = new Map();         // projectId -> sessions
  private subagentSessions: Map<string, Session[]> = new Map(); // projectId -> subagent sessions
  private activeSessions: Map<string, Session> = new Map();     // sessionId -> session
  private sessionParser: SessionParser;
  private settingsParser: SettingsParser;
  private emitDebounce?: NodeJS.Timeout;

  constructor(claudeDir: string, cacheDir?: string) {
    super();
    this.claudeDir = claudeDir;
    this.cacheDir = cacheDir ?? null;
    this.sessionParser = new SessionParser();
    this.settingsParser = new SettingsParser();
  }

  private getCachePath(): string | null {
    if (!this.cacheDir) { return null; }
    return path.join(this.cacheDir, 'project-cache.json');
  }

  private loadCacheFromDisk() {
    const cachePath = this.getCachePath();
    if (!cachePath || !fs.existsSync(cachePath)) { return; }
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheFile;
      if (data.version === CACHE_VERSION) { this.cacheData = data; }
    } catch { /* ignore corrupt cache */ }
  }

  private saveCacheToDisk() {
    const cachePath = this.getCachePath();
    if (!cachePath) { return; }
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(this.cacheData));
    } catch { /* ignore write errors */ }
  }

  private getProjectMaxMtime(projectDir: string): number {
    try {
      const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      let maxMtime = 0;
      for (const file of files) {
        const stat = fs.statSync(path.join(projectDir, file));
        if (stat.mtimeMs > maxMtime) { maxMtime = stat.mtimeMs; }
      }
      return maxMtime;
    } catch { return Date.now(); } // force re-parse on error
  }

  private debouncedEmitUpdated() {
    if (this.emitDebounce) { clearTimeout(this.emitDebounce); }
    this.emitDebounce = setTimeout(() => this.emit('updated'), 200);
  }

  async initialize() {
    await this.scanProjects();
    this.emit('updated');
  }

  async refresh() {
    await this.scanProjects();
    this.emit('updated');
  }

  private async scanProjects() {
    this.loadCacheFromDisk();
    const projectsDir = path.join(this.claudeDir, 'projects');
    if (!fs.existsSync(projectsDir)) { return; }

    // Read live session IDs once for all projects instead of per-project
    const liveResult = this.getLiveSessionIds();
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) { continue; }
      await this.loadProject(entry.name, path.join(projectsDir, entry.name), liveResult);
    }
    this.saveCacheToDisk();
  }

  /** Check if a process with the given pid is still running */
  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Read ~/.claude/sessions/ and return live session IDs + whether PID tracking is available */
  private getLiveSessionIds(): { ids: Set<string>; available: boolean } {
    const liveIds = new Set<string>();
    const sessionsDir = path.join(this.claudeDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) { return { ids: liveIds, available: false }; }
    try {
      const files = fs.readdirSync(sessionsDir);
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
          const meta = JSON.parse(content) as { pid?: number; sessionId?: string };
          if (meta.pid && meta.sessionId && this.isPidAlive(meta.pid)) {
            liveIds.add(meta.sessionId);
          } else if (meta.pid && !this.isPidAlive(meta.pid)) {
            try { fs.unlinkSync(path.join(sessionsDir, file)); } catch {}
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* ignore */ }
    return { ids: liveIds, available: true };
  }

  /**
   * Parse subagents/*.jsonl — stores the full sessions and returns a cost map
   * keyed by parent session ID (or '__unknown__') for cost attribution.
   */
  private loadSubagentSessions(projectDir: string, encodedId: string): Map<string, number> {
    const costs = new Map<string, number>();
    const parsed: Session[] = [];
    const subagentsDir = path.join(projectDir, 'subagents');
    if (!fs.existsSync(subagentsDir)) {
      this.subagentSessions.set(encodedId, []);
      return costs;
    }
    try {
      const files = fs.readdirSync(subagentsDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(subagentsDir, file);

        // Scan first lines for a parent session reference
        let parentSessionId: string | null = null;
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          for (const line of content.split('\n')) {
            if (!line.trim()) { continue; }
            try {
              const entry = JSON.parse(line);
              const pid = entry.parentSessionId ?? entry.parent_session_id ?? entry.parentId ?? null;
              if (pid) { parentSessionId = String(pid); break; }
            } catch { continue; }
          }
        } catch { /* keep null */ }

        const session = this.sessionParser.parseFile(filePath, encodedId);
        if (session) {
          (session as any).parentSessionId = parentSessionId;
          parsed.push(session);
          const key = parentSessionId ?? '__unknown__';
          costs.set(key, (costs.get(key) ?? 0) + session.costUsd);
        }
      }
    } catch { /* ignore */ }
    this.subagentSessions.set(encodedId, parsed);
    return costs;
  }

  private async loadProject(encodedId: string, projectDir: string, liveResult?: { ids: Set<string>; available: boolean }) {
    try {
      const sessionFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      if (sessionFiles.length === 0) { return; }

      // Use provided live IDs or fetch them (e.g. when called from onFileChanged)
      if (!liveResult) { liveResult = this.getLiveSessionIds(); }

      // ── Cache check ───────────────────────────────────────────────────────
      const maxMtime = this.getProjectMaxMtime(projectDir);
      const cached   = this.cacheData.entries[encodedId];
      if (cached && cached.cachedAt >= maxMtime) {
        // Re-apply live detection (runtime state, cannot be cached)
        const sessions = cached.sessions.map(s => ({
          ...s,
          isActiveSession: liveResult!.available ? liveResult!.ids.has(s.id) : s.isActiveSession,
        }));
        const isActive = sessions.some(s => s.isActiveSession);
        this.projects.set(encodedId, { ...cached.project, isActive });
        this.sessions.set(encodedId, sessions);
        this.subagentSessions.set(encodedId, cached.subagentSessions ?? []);
        return;
      }

      // ── Parse ─────────────────────────────────────────────────────────────
      const subagentCosts = this.loadSubagentSessions(projectDir, encodedId);

      let totalTokens = 0;
      let totalCostUsd = 0;
      let lastActive = 0;
      let sessionCount = 0;
      let resolvedCwd: string | null = null;
      const parsedSessions: Session[] = [];

      for (const file of sessionFiles) {
        const filePath = path.join(projectDir, file);
        const session = this.sessionParser.parseFile(filePath, encodedId);
        if (session) {
          if (!resolvedCwd && session.cwd) { resolvedCwd = session.cwd; }
          if (liveResult.available) {
            (session as any).isActiveSession = liveResult.ids.has(session.id);
          }
          parsedSessions.push(session);
          totalTokens += session.totalTokens;
          totalCostUsd += session.costUsd;
          sessionCount++;
          const sessionLatest = session.endTime ?? (session.turns.length > 0
            ? session.turns[session.turns.length - 1].timestamp
            : session.startTime);
          if (sessionLatest > lastActive) { lastActive = sessionLatest; }
        }
      }

      // Attribute subagent costs: use parentSessionId when known, else newest session
      const newest = parsedSessions.length > 0
        ? parsedSessions.reduce((a, b) => a.startTime > b.startTime ? a : b)
        : null;
      for (const [parentId, cost] of subagentCosts) {
        const target = (parentId !== '__unknown__' ? parsedSessions.find(s => s.id === parentId) : null) ?? newest;
        if (target) {
          (target as any).subagentCostUsd = ((target as any).subagentCostUsd ?? 0) + cost;
          totalCostUsd += cost;
        }
      }

      // Fall back to decoding the directory name if cwd wasn't found in any session
      const projectPath = resolvedCwd ?? ('/' + encodedId.replace(/^-/, '').replace(/-/g, '/'));
      const name = path.basename(projectPath);
      const isActive = parsedSessions.some(s => s.isActiveSession);

      const project: Project = {
        id: encodedId,
        name,
        path: projectPath,
        lastActive,
        isActive,
        sessionCount,
        totalTokens,
        totalCostUsd,
        techStack: this.detectTechStack(projectPath),
      };

      this.projects.set(encodedId, project);
      this.sessions.set(encodedId, parsedSessions);

      // Update cache entry for this project
      const cachedSubagents = this.subagentSessions.get(encodedId) ?? [];
      this.cacheData.entries[encodedId] = { cachedAt: Date.now(), project, sessions: parsedSessions, subagentSessions: cachedSubagents };
    } catch (e) {
      console.error(`Failed to load project ${encodedId}:`, e);
    }
  }

  private detectTechStack(projectPath: string): string[] {
    if (!fs.existsSync(projectPath)) { return []; }
    const stack: string[] = [];
    const files = (() => { try { return fs.readdirSync(projectPath); } catch { return []; } })();
    if (files.includes('package.json')) { stack.push('Node.js'); }
    if (files.includes('tsconfig.json')) { stack.push('TypeScript'); }
    if (files.includes('pyproject.toml') || files.includes('requirements.txt')) { stack.push('Python'); }
    if (files.includes('go.mod')) { stack.push('Go'); }
    if (files.includes('Cargo.toml')) { stack.push('Rust'); }
    return stack;
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values()).sort((a, b) => b.lastActive - a.lastActive);
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getSessions(projectId: string): Session[] {
    return this.sessions.get(projectId) ?? [];
  }

  getSubagentSessions(projectId: string): Session[] {
    return this.subagentSessions.get(projectId) ?? [];
  }

  getStats(): DashboardStats {
    const now = Date.now();
    const dayMs = 86_400_000;
    const weekMs = 7 * dayMs;
    const projects = this.getProjects();

    let tokensTodayTotal = 0;
    let tokensWeekTotal = 0;
    let costTodayUsd = 0;
    let costWeekUsd = 0;
    let activeSessionCount = 0;

    for (const project of projects) {
      const sessions = this.getSessions(project.id);
      for (const session of sessions) {
        if (session.isActiveSession) { activeSessionCount++; }
        if (session.startTime > now - dayMs) { tokensTodayTotal += session.totalTokens; costTodayUsd += session.costUsd; }
        if (session.startTime > now - weekMs) { tokensWeekTotal += session.totalTokens; costWeekUsd += session.costUsd; }
      }
    }

    return {
      totalProjects: projects.length,
      activeSessionCount,
      tokensTodayTotal,
      costTodayUsd,
      tokensWeekTotal,
      costWeekUsd,
    };
  }

  getUsageOverTime(days: number): { date: string; tokens: number; costUsd: number }[] {
    const now = Date.now();
    const dayMs = 86_400_000;
    const result: { date: string; tokens: number; costUsd: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd = now - i * dayMs;
      const d = new Date(dayStart);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

      let tokens = 0;
      let costUsd = 0;
      for (const [, sessions] of this.sessions) {
        for (const session of sessions) {
          if (session.startTime >= dayStart && session.startTime < dayEnd) {
            tokens += session.totalTokens;
            costUsd += session.costUsd;
          }
        }
      }
      result.push({ date: dateStr, tokens, costUsd });
    }

    return result;
  }

  getUsageByProject(): { id: string; name: string; tokens: number; costUsd: number }[] {
    const projects = this.getProjects();
    return projects
      .map(p => ({
        id: p.id,
        name: p.name,
        tokens: p.totalTokens,
        costUsd: p.totalCostUsd,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  }

  getHeatmapData(): { hour: number; day: number; tokens: number }[] {
    // day 0=Sun..6=Sat, hour 0-23
    const grid: Map<string, number> = new Map();

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        if (!session.startTime) { continue; }
        const d = new Date(session.startTime);
        const hour = d.getHours();
        const day = d.getDay();
        const key = `${day}:${hour}`;
        grid.set(key, (grid.get(key) ?? 0) + session.totalTokens);
      }
    }

    const result: { hour: number; day: number; tokens: number }[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}:${hour}`;
        result.push({ hour, day, tokens: grid.get(key) ?? 0 });
      }
    }
    return result;
  }

  searchPrompts(query: string): PromptSearchResult[] {
    if (!query || query.trim().length === 0) { return []; }
    const q = query.trim().toLowerCase();
    const results: PromptSearchResult[] = [];

    for (const project of this.getProjects()) {
      const sessions = this.getSessions(project.id);
      for (const session of sessions) {
        for (const turn of session.turns) {
          if (turn.role !== 'user') { continue; }
          const content = turn.content.toLowerCase();
          const idx = content.indexOf(q);
          if (idx === -1) { continue; }

          const start = Math.max(0, idx - 40);
          const end = Math.min(turn.content.length, idx + q.length + 40);
          const snippet = (start > 0 ? '...' : '') + turn.content.slice(start, end) + (end < turn.content.length ? '...' : '');

          results.push({
            projectId: project.id,
            projectName: project.name,
            sessionId: session.id,
            turn,
            snippet,
          });
        }
      }
    }

    return results;
  }

  getPromptPatterns(): { category: string; count: number }[] {
    const counts: Record<string, number> = {
      'Fix/Bug': 0,
      'Explain': 0,
      'Refactor': 0,
      'Feature': 0,
      'Test': 0,
      'Other': 0,
    };

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        for (const turn of session.turns) {
          if (turn.role !== 'user' || !turn.content) { continue; }
          const text = turn.content;

          if (/\b(fix|bug|error|crash|broken|issue|fail|wrong|debug)\b/i.test(text)) {
            counts['Fix/Bug']++;
          } else if (/\b(explain|what|how|why|understand|describe|help me|tell me)\b/i.test(text)) {
            counts['Explain']++;
          } else if (/\b(refactor|clean|improve|optimize|restructure|simplify)\b/i.test(text)) {
            counts['Refactor']++;
          } else if (/\b(add|create|implement|build|make|new feature|generate)\b/i.test(text)) {
            counts['Feature']++;
          } else if (/\b(test|spec|unit|e2e|coverage|jest|vitest)\b/i.test(text)) {
            counts['Test']++;
          } else {
            counts['Other']++;
          }
        }
      }
    }

    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }

  getProjectConfig(projectId: string): ProjectConfig {
    const project = this.projects.get(projectId);
    if (!project) {
      return { claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [] };
    }

    const claudeMd = this.settingsParser.readClaudeMd(project.path);
    const projectSettings = this.settingsParser.readProjectSettings(project.path);
    const globalSettings = this.settingsParser.readGlobalSettings(this.claudeDir);
    const userClaudeJson = this.settingsParser.readUserClaudeJson(os.homedir());
    const projectMcpJson = this.settingsParser.readProjectMcpJson(project.path);

    // Merge MCP servers from all sources (lower priority first, higher overrides)
    // Order: global settings < ~/.claude.json (user) < project .claude/settings.json < project .mcp.json
    const rawGlobalMcp = (globalSettings.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
    const rawUserMcp = (userClaudeJson.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
    const rawProjectSettingsMcp = (projectSettings.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
    const rawProjectMcpJson = (projectMcpJson.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
    const rawMcp: Record<string, Record<string, unknown>> = { ...rawGlobalMcp, ...rawUserMcp, ...rawProjectSettingsMcp, ...rawProjectMcpJson };

    const mcpServers: Record<string, McpServer> = {};
    for (const [name, raw] of Object.entries(rawMcp)) {
      mcpServers[name] = {
        name,
        command: raw.command as string | undefined,
        url: raw.url as string | undefined,
        type: raw.type as string | undefined,
        toolCallCount: 0,
      };
    }

    // Aggregate MCP tool call counts from all sessions for this project
    const allSessions = [
      ...(this.sessions.get(projectId) ?? []),
      ...(this.subagentSessions.get(projectId) ?? []),
    ];
    for (const session of allSessions) {
      for (const turn of session.turns) {
        for (const tc of turn.toolCalls) {
          if (tc.mcpServer && mcpServers[tc.mcpServer]) {
            mcpServers[tc.mcpServer].toolCallCount++;
          }
        }
      }
    }

    const commands = this.settingsParser.readProjectCommands(project.path);

    return {
      claudeMd,
      mcpServers,
      projectSettings: projectSettings as Record<string, unknown>,
      commands,
    };
  }

  getMonthlyTokens(): number {
    return this.getMonthlyUsage().tokens;
  }

  getMonthlyUsage(): { tokens: number; costUsd: number } {
    const now = Date.now();
    const d = new Date(now);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    let tokens = 0;
    let costUsd = 0;

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        if (session.startTime >= monthStart) {
          tokens += session.totalTokens;
          costUsd += session.costUsd + (session.subagentCostUsd ?? 0);
        }
      }
    }
    return { tokens, costUsd };
  }

  getAllPrompts(): PromptSearchResult[] {
    const results: PromptSearchResult[] = [];

    for (const project of this.getProjects()) {
      const sessions = this.getSessions(project.id);
      for (const session of sessions) {
        for (const turn of session.turns) {
          if (turn.role !== 'user' || !turn.content) { continue; }
          results.push({
            projectId: project.id,
            projectName: project.name,
            sessionId: session.id,
            turn,
            snippet: turn.content.slice(0, 120) + (turn.content.length > 120 ? '...' : ''),
          });
        }
      }
    }

    // Sort newest first, cap at 500
    results.sort((a, b) => b.turn.timestamp - a.turn.timestamp);
    return results.slice(0, 500);
  }

  handleLiveEvent(event: LiveEvent) {
    if (event.type === 'session_stop' && event.sessionId) {
      for (const [projectId, sessions] of this.sessions) {
        for (const session of sessions) {
          if (session.id === event.sessionId && session.isActiveSession) {
            (session as any).isActiveSession = false;
            const project = this.projects.get(projectId);
            if (project) {
              project.isActive = sessions.some(s => s.isActiveSession);
            }
            break;
          }
        }
      }
    }
    this.emit('liveEvent', event);
    this.debouncedEmitUpdated();
  }

  async onFileChanged(filePath: string) {
    const projectsDir = path.join(this.claudeDir, 'projects');
    const rel = path.relative(projectsDir, filePath);
    const projectId = rel.split(path.sep)[0];
    if (projectId) {
      const projectDir = path.join(projectsDir, projectId);
      await this.loadProject(projectId, projectDir);
      this.saveCacheToDisk();
      this.debouncedEmitUpdated();
    }
  }

  getToolUsageStats(): ToolUsageStat[] {
    const counts: Map<string, number> = new Map();
    let total = 0;

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        for (const turn of session.turns) {
          for (const tc of turn.toolCalls) {
            counts.set(tc.name, (counts.get(tc.name) ?? 0) + 1);
            total++;
          }
        }
      }
    }

    if (total === 0) { return []; }

    return Array.from(counts.entries())
      .map(([tool, count]) => ({
        tool,
        count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  getHotFiles(limit = 20): HotFile[] {
    // key: fullPath -> { file, fullPath, editCount, projectSet }
    const map: Map<string, { file: string; fullPath: string; editCount: number; projects: Set<string> }> = new Map();

    for (const project of this.getProjects()) {
      const sessions = this.getSessions(project.id);
      for (const session of sessions) {
        for (const fp of session.filesModified) {
          const existing = map.get(fp);
          if (existing) {
            existing.editCount++;
            existing.projects.add(project.name);
          } else {
            map.set(fp, {
              file: path.basename(fp),
              fullPath: fp,
              editCount: 1,
              projects: new Set([project.name]),
            });
          }
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, limit)
      .map(({ file, fullPath, editCount, projects }) => ({
        file,
        fullPath,
        editCount,
        projects: Array.from(projects),
      }));
  }

  getProjectedCost(): ProjectedCost {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysRemaining = daysInMonth - daysElapsed;

    let currentMonthCost = 0;
    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        if (session.startTime >= monthStart) {
          currentMonthCost += session.costUsd;
        }
      }
    }

    const dailyAvgCost = currentMonthCost / daysElapsed;
    const projectedMonthCost = dailyAvgCost * daysInMonth;

    return {
      dailyAvgCost,
      projectedMonthCost,
      currentMonthCost,
      daysElapsed,
      daysRemaining,
    };
  }

  getStreak(): StreakData {
    const dateSet: Set<string> = new Set();

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        if (!session.startTime) { continue; }
        const d = new Date(session.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dateSet.add(key);
      }
    }

    const sortedDates = Array.from(dateSet).sort();
    const totalActiveDays = sortedDates.length;

    if (totalActiveDays === 0) {
      return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
    }

    // Helper: get YYYY-MM-DD string for a Date offset by N days from today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const getDateStr = (offsetDays: number): string => {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // currentStreak: count consecutive days going backwards from today (or yesterday)
    let currentStreak = 0;
    let offset = dateSet.has(todayStr) ? 0 : 1;
    while (dateSet.has(getDateStr(offset))) {
      currentStreak++;
      offset++;
    }

    // longestStreak: iterate sorted dates
    let longestStreak = 1;
    let runLen = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
      if (diffDays === 1) {
        runLen++;
        if (runLen > longestStreak) { longestStreak = runLen; }
      } else {
        runLen = 1;
      }
    }

    return { currentStreak, longestStreak, totalActiveDays };
  }

  getEfficiencyStats(): EfficiencyStats {
    let totalTokens = 0;
    let totalPrompts = 0;
    let totalToolCalls = 0;
    let totalSessions = 0;
    let totalDurationMs = 0;
    let durationCount = 0;
    let singlePromptSessions = 0;
    let totalActiveRatio = 0;
    let activeRatioCount = 0;

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        totalSessions++;
        totalTokens += session.totalTokens;
        totalPrompts += session.promptCount;
        totalToolCalls += session.toolCallCount;
        if (session.durationMs !== null) {
          totalDurationMs += session.durationMs;
          durationCount++;
        }
        if (session.promptCount === 1) { singlePromptSessions++; }
        if (session.activityRatio !== null && session.activityRatio !== undefined) {
          totalActiveRatio += session.activityRatio;
          activeRatioCount++;
        }
      }
    }

    return {
      avgTokensPerPrompt: totalPrompts > 0 ? Math.round(totalTokens / totalPrompts) : 0,
      avgToolCallsPerSession: totalSessions > 0 ? Math.round((totalToolCalls / totalSessions) * 10) / 10 : 0,
      avgSessionDurationMin: durationCount > 0 ? Math.round((totalDurationMs / durationCount / 60000) * 10) / 10 : 0,
      firstTurnResolutionRate: totalSessions > 0 ? Math.round((singlePromptSessions / totalSessions) * 1000) / 10 : 0,
      avgActiveRatio: activeRatioCount > 0 ? Math.round((totalActiveRatio / activeRatioCount) * 10) / 10 : 0,
    };
  }

  getWeeklyRecap(): WeeklyRecap {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const projectTokenMap: Map<string, { name: string; tokens: number }> = new Map();
    const toolCounts: Map<string, number> = new Map();

    let sessions = 0;
    let tokens = 0;
    let costUsd = 0;
    let filesModifiedSet: Set<string> = new Set();
    let longestSessionMs = 0;
    const projectsInWeek: Set<string> = new Set();

    for (const project of this.getProjects()) {
      for (const session of this.getSessions(project.id)) {
        if (session.startTime < weekAgo) { continue; }
        sessions++;
        tokens += session.totalTokens;
        costUsd += session.costUsd;
        session.filesModified.forEach(f => filesModifiedSet.add(f));
        projectsInWeek.add(project.id);

        if (session.durationMs && session.durationMs > longestSessionMs) {
          longestSessionMs = session.durationMs;
        }

        const existing = projectTokenMap.get(project.id);
        if (existing) {
          existing.tokens += session.totalTokens;
        } else {
          projectTokenMap.set(project.id, { name: project.name, tokens: session.totalTokens });
        }

        for (const turn of session.turns) {
          for (const tc of turn.toolCalls) {
            toolCounts.set(tc.name, (toolCounts.get(tc.name) ?? 0) + 1);
          }
        }
      }
    }

    let topProject = '';
    let topProjectTokens = 0;
    for (const { name, tokens: t } of projectTokenMap.values()) {
      if (t > topProjectTokens) { topProjectTokens = t; topProject = name; }
    }

    let mostUsedTool = '';
    let maxToolCount = 0;
    for (const [tool, count] of toolCounts.entries()) {
      if (count > maxToolCount) { maxToolCount = count; mostUsedTool = tool; }
    }

    return {
      sessions,
      projects: projectsInWeek.size,
      tokens,
      costUsd,
      filesModified: filesModifiedSet.size,
      topProject,
      topProjectTokens,
      longestSessionMin: Math.round(longestSessionMs / 60000 * 10) / 10,
      mostUsedTool,
    };
  }

  getRecentFileChanges(days = 7): RecentFileChange[] {
    const cutoff = Date.now() - days * 86_400_000;
    const changes: RecentFileChange[] = [];

    for (const project of this.getProjects()) {
      for (const session of this.getSessions(project.id)) {
        if (session.startTime < cutoff) { continue; }
        for (const fp of session.filesModified) {
          const isCreated = session.filesCreated?.includes(fp);
          changes.push({
            file: path.basename(fp),
            fullPath: fp,
            type: isCreated ? 'created' : 'modified',
            project: project.name,
            projectId: project.id,
            timestamp: session.startTime,
          });
        }
      }
    }

    // Sort newest first
    changes.sort((a, b) => b.timestamp - a.timestamp);
    return changes;
  }

  getProjectStats(projectId: string): {
    usageOverTime: { date: string; tokens: number; costUsd: number }[];
    toolUsage: ToolUsageStat[];
    promptPatterns: { category: string; count: number }[];
    efficiency: EfficiencyStats;
    recentToolCalls: { tool: string; input: Record<string, unknown>; sessionId: string; sessionDate: number; timestamp: number }[];
    weeklyStats: { sessions: number; tokens: number; costUsd: number; dailyBreakdown: { date: string; tokens: number; costUsd: number; sessions: number }[] };
  } {
    const sessions = this.getSessions(projectId);
    const now = Date.now();
    const dayMs = 86_400_000;

    // Usage over last 30 days
    const usageOverTime: { date: string; tokens: number; costUsd: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd   = now - i * dayMs;
      const d = new Date(dayStart);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      let tokens = 0; let costUsd = 0;
      for (const s of sessions) {
        if (s.startTime >= dayStart && s.startTime < dayEnd) {
          tokens  += s.totalTokens;
          costUsd += s.costUsd;
        }
      }
      usageOverTime.push({ date: dateStr, tokens, costUsd });
    }

    // Tool usage
    const toolCounts: Map<string, number> = new Map();
    let totalTools = 0;
    for (const s of sessions) {
      for (const turn of s.turns) {
        for (const tc of turn.toolCalls) {
          toolCounts.set(tc.name, (toolCounts.get(tc.name) ?? 0) + 1);
          totalTools++;
        }
      }
    }
    const toolUsage: ToolUsageStat[] = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count, percentage: totalTools > 0 ? Math.round((count / totalTools) * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count);

    // Prompt patterns
    const counts: Record<string, number> = { 'Fix/Bug': 0, 'Explain': 0, 'Refactor': 0, 'Feature': 0, 'Test': 0, 'Other': 0 };
    for (const s of sessions) {
      for (const t of s.turns) {
        if (t.role !== 'user' || !t.content) { continue; }
        if (/\b(fix|bug|error|crash|broken|issue|fail|wrong|debug)\b/i.test(t.content))         { counts['Fix/Bug']++; }
        else if (/\b(explain|what|how|why|understand|describe|help me|tell me)\b/i.test(t.content)) { counts['Explain']++; }
        else if (/\b(refactor|clean|improve|optimize|restructure|simplify)\b/i.test(t.content))     { counts['Refactor']++; }
        else if (/\b(add|create|implement|build|make|new feature|generate)\b/i.test(t.content))     { counts['Feature']++; }
        else if (/\b(test|spec|unit|e2e|coverage|jest|vitest)\b/i.test(t.content))                  { counts['Test']++; }
        else                                                                                          { counts['Other']++; }
      }
    }
    const promptPatterns = Object.entries(counts).map(([category, count]) => ({ category, count }));

    // Efficiency
    let totalTokens = 0, totalPrompts = 0, totalToolCalls = 0;
    let totalDurationMs = 0, durationCount = 0, singlePromptSessions = 0;
    let totalActiveRatio = 0, activeRatioCount = 0;
    for (const s of sessions) {
      totalTokens    += s.totalTokens;
      totalPrompts   += s.promptCount;
      totalToolCalls += s.toolCallCount;
      if (s.durationMs !== null) { totalDurationMs += s.durationMs; durationCount++; }
      if (s.promptCount === 1) { singlePromptSessions++; }
      if (s.activityRatio !== null && s.activityRatio !== undefined) {
        totalActiveRatio += s.activityRatio;
        activeRatioCount++;
      }
    }
    const n = sessions.length;
    const efficiency: EfficiencyStats = {
      avgTokensPerPrompt:      totalPrompts > 0 ? Math.round(totalTokens   / totalPrompts) : 0,
      avgToolCallsPerSession:  n > 0             ? Math.round((totalToolCalls / n) * 10) / 10 : 0,
      avgSessionDurationMin:   durationCount > 0 ? Math.round((totalDurationMs / durationCount / 60000) * 10) / 10 : 0,
      firstTurnResolutionRate: n > 0             ? Math.round((singlePromptSessions / n) * 1000) / 10 : 0,
      avgActiveRatio:          activeRatioCount > 0 ? Math.round((totalActiveRatio / activeRatioCount) * 10) / 10 : 0,
    };

    // Recent tool calls (up to 60, newest first)
    type TcEntry = { tool: string; input: Record<string, unknown>; sessionId: string; sessionDate: number; timestamp: number };
    const allCalls: TcEntry[] = [];
    for (const s of sessions) {
      for (const turn of s.turns) {
        for (const tc of turn.toolCalls) {
          allCalls.push({ tool: tc.name, input: tc.input, sessionId: s.id, sessionDate: s.startTime, timestamp: turn.timestamp });
        }
      }
    }
    allCalls.sort((a, b) => b.timestamp - a.timestamp);
    const recentToolCalls = allCalls.slice(0, 60);

    // Weekly stats (last 7 days)
    const weekAgo = now - 7 * dayMs;
    const weeklySessions = sessions.filter(s => s.startTime >= weekAgo);
    const weeklyDailyBreakdown: { date: string; tokens: number; costUsd: number; sessions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd   = now - i * dayMs;
      const d = new Date(dayStart);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      let tokens = 0; let costUsd = 0; let sessionsCount = 0;
      for (const s of sessions) {
        if (s.startTime >= dayStart && s.startTime < dayEnd) {
          tokens += s.totalTokens;
          costUsd += s.costUsd;
          sessionsCount++;
        }
      }
      weeklyDailyBreakdown.push({ date: dateStr, tokens, costUsd, sessions: sessionsCount });
    }
    const weeklyStats = {
      sessions: weeklySessions.length,
      tokens: weeklySessions.reduce((sum, s) => sum + s.totalTokens, 0),
      costUsd: weeklySessions.reduce((sum, s) => sum + s.costUsd, 0),
      dailyBreakdown: weeklyDailyBreakdown,
    };

    return { usageOverTime, toolUsage, promptPatterns, efficiency, recentToolCalls, weeklyStats };
  }

  getProjectFiles(projectId: string): {
    file: string; fullPath: string; type: 'created' | 'modified' | 'both'; editCount: number; lastTouched: number;
  }[] {
    const sessions = this.getSessions(projectId);
    const map = new Map<string, { file: string; fullPath: string; created: boolean; modified: boolean; editCount: number; lastTouched: number }>();

    for (const s of sessions) {
      for (const fp of s.filesModified) {
        const isCreated = s.filesCreated?.includes(fp) ?? false;
        const existing  = map.get(fp);
        if (existing) {
          existing.editCount++;
          if (s.startTime > existing.lastTouched) { existing.lastTouched = s.startTime; }
          if (isCreated) { existing.created = true; } else { existing.modified = true; }
        } else {
          map.set(fp, { file: path.basename(fp), fullPath: fp, created: isCreated, modified: !isCreated, editCount: 1, lastTouched: s.startTime });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.editCount - a.editCount)
      .map(({ file, fullPath, created, modified, editCount, lastTouched }) => ({
        file, fullPath,
        type: (created && modified ? 'both' : created ? 'created' : 'modified') as 'created' | 'modified' | 'both',
        editCount, lastTouched,
      }));
  }

  getProductivityByHour(): ProductivityHour[] {
    const hourMap: Map<number, { toolCalls: number; filesModified: number; sessionCount: number }> = new Map();

    for (let h = 0; h < 24; h++) {
      hourMap.set(h, { toolCalls: 0, filesModified: 0, sessionCount: 0 });
    }

    for (const [, sessions] of this.sessions) {
      for (const session of sessions) {
        if (!session.startTime) { continue; }
        const hour = new Date(session.startTime).getHours();
        const entry = hourMap.get(hour)!;
        entry.sessionCount++;
        entry.toolCalls += session.toolCallCount;
        entry.filesModified += session.filesModified.length;
      }
    }

    return Array.from(hourMap.entries()).map(([hour, { toolCalls, filesModified, sessionCount }]) => ({
      hour,
      avgToolCalls: sessionCount > 0 ? Math.round((toolCalls / sessionCount) * 10) / 10 : 0,
      avgFilesModified: sessionCount > 0 ? Math.round((filesModified / sessionCount) * 10) / 10 : 0,
      sessionCount,
    }));
  }
}
