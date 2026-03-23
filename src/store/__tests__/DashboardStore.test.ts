import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardStore } from '../DashboardStore';
import { createPopulatedStore } from '../../__tests__/helpers/store-helpers';
import { makeProject, makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

vi.mock('fs');

type SettingsParserLike = {
  readClaudeMd(projectPath: string): string | null;
  readProjectSettings(projectPath: string): Record<string, unknown>;
  readGlobalSettings(claudeDir: string): Record<string, unknown>;
  readUserClaudeJson(homeDir: string): Record<string, unknown>;
  readProjectMcpJson(projectPath: string): Record<string, unknown>;
  readProjectCommands(projectPath: string): { name: string; content: string }[];
};
type StoreWithSettingsParser = {
  settingsParser: SettingsParserLike;
};

describe('DashboardStore', () => {
  const NOW = new Date('2025-01-15T12:00:00Z').getTime();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeStore() {
    const projectA = makeProject({ id: 'p1', name: 'Alpha', lastActive: NOW - HOUR, totalTokens: 15000, totalCostUsd: 1.2 });
    const projectB = makeProject({ id: 'p2', name: 'Beta', lastActive: NOW - 2 * DAY, isActive: true, totalTokens: 8000, totalCostUsd: 0.8 });

    const s1 = makeSession({
      id: 's1',
      projectId: 'p1',
      startTime: NOW - HOUR,
      totalTokens: 5000,
      costUsd: 0.2,
      isActiveSession: true,
      promptCount: 1,
      toolCallCount: 2,
      filesModified: ['/app/index.ts', '/app/new.ts'],
      filesCreated: ['/app/new.ts'],
      turns: [
        makeTurn({ id: 't1', role: 'user', content: 'Fix bug in parser', timestamp: NOW - HOUR }),
        makeTurn({ id: 't2', role: 'assistant', content: '', timestamp: NOW - HOUR + 1000, toolCalls: [
          makeToolCall({ id: 'tc1', name: 'Edit', input: { file_path: '/app/index.ts' } }),
          makeToolCall({ id: 'tc2', name: 'mcp__github__search', input: { query: 'issue' }, mcpServer: 'github' }),
        ] }),
      ],
      activityRatio: 80,
      durationMs: 600000,
      subagentCostUsd: 0.3,
    });
    const s2 = makeSession({
      id: 's2',
      projectId: 'p1',
      startTime: NOW - 3 * DAY,
      totalTokens: 3000,
      costUsd: 0.1,
      promptCount: 2,
      toolCallCount: 1,
      turns: [makeTurn({ role: 'user', content: 'Explain architecture', timestamp: NOW - 3 * DAY })],
      durationMs: 300000,
      activityRatio: 50,
    });
    const s3 = makeSession({
      id: 's3',
      projectId: 'p2',
      startTime: NOW - 8 * DAY,
      totalTokens: 9000,
      costUsd: 0.5,
      promptCount: 1,
      toolCallCount: 0,
      turns: [makeTurn({ role: 'user', content: 'Write tests', timestamp: NOW - 8 * DAY })],
      filesModified: ['/beta/file.ts'],
    });
    const subagent = makeSession({
      id: 'sub-1',
      projectId: 'p1',
      parentSessionId: 's1',
      turns: [makeTurn({ role: 'assistant', toolCalls: [makeToolCall({ name: 'mcp__github__search', mcpServer: 'github' })] })],
    });

    return createPopulatedStore([projectA, projectB], { p1: [s1, s2], p2: [s3] }, { p1: [subagent] });
  }

  it('returns sorted projects and direct lookups', () => {
    const store = makeStore();
    expect(store.getProjects().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.getProject('p1')?.name).toBe('Alpha');
    expect(store.getSessions('p1')).toHaveLength(2);
    expect(store.getSubagentSessions('p1')).toHaveLength(1);
  });

  it('computes stats, time series, and monthly usage', () => {
    const store = makeStore();
    const stats = store.getStats();
    const usage = store.getUsageOverTime(7);
    const monthly = store.getMonthlyUsage();

    expect(stats.totalProjects).toBe(2);
    expect(stats.activeSessionCount).toBe(1);
    expect(stats.tokensTodayTotal).toBe(5000);
    expect(stats.tokensWeekTotal).toBe(8000);
    expect(usage).toHaveLength(7);
    expect(usage[6].tokens).toBe(5000);
    expect(monthly).toEqual({ tokens: 17000, costUsd: 1.1 });
  });

  it('computes aggregate analytics and search results', () => {
    const store = makeStore();

    expect(store.getUsageByProject()[0].id).toBe('p1');
    expect(store.getHeatmapData()).toHaveLength(168);
    expect(store.searchPrompts('BUG')).toHaveLength(1);
    expect(store.getPromptPatterns().find((x) => x.category === 'Fix/Bug')?.count).toBe(1);
    expect(store.getAllPrompts()).toHaveLength(3);
    expect(store.getToolUsageStats()[0]).toMatchObject({ tool: 'Edit', count: 1 });
    expect(store.getHotFiles(5)[0]).toMatchObject({ file: 'index.ts', editCount: 1 });
  });

  it('computes cost, streak, efficiency, recap, recent changes, project stats, files, and productivity', () => {
    const store = makeStore();
    const projected = store.getProjectedCost();
    const streak = store.getStreak();
    const efficiency = store.getEfficiencyStats();
    const recap = store.getWeeklyRecap();
    const changes = store.getRecentFileChanges();
    const projectStats = store.getProjectStats('p1');
    const files = store.getProjectFiles('p1');
    const productivity = store.getProductivityByHour();

    expect(projected.currentMonthCost).toBeCloseTo(0.8);
    expect(streak.totalActiveDays).toBe(3);
    expect(efficiency.avgToolCallsPerSession).toBeCloseTo(1.0);
    expect(recap.sessions).toBe(2);
    expect(recap.topProject).toBe('Alpha');
    expect(changes[0]?.type).toBe('modified');
    expect(projectStats.toolUsage[0].tool).toBe('Edit');
    expect(projectStats.recentToolCalls[0].tool).toBe('Edit');
    expect(files[0]).toMatchObject({ fullPath: '/app/index.ts', type: 'modified' });
    expect(productivity).toHaveLength(24);
  });

  it('merges config sources and MCP tool counts', () => {
    const store = makeStore();
    const settingsParser = (store as unknown as StoreWithSettingsParser).settingsParser;
    vi.spyOn(settingsParser, 'readClaudeMd').mockReturnValue('# Rules');
    vi.spyOn(settingsParser, 'readProjectSettings').mockReturnValue({ mcpServers: { github: { command: 'from-project' } }, project: true });
    vi.spyOn(settingsParser, 'readGlobalSettings').mockReturnValue({ mcpServers: { github: { command: 'from-global' }, local: { type: 'stdio' } } });
    vi.spyOn(settingsParser, 'readUserClaudeJson').mockReturnValue({ mcpServers: { user: { url: 'http://localhost' } } });
    vi.spyOn(settingsParser, 'readProjectMcpJson').mockReturnValue({ mcpServers: { github: { command: 'from-mcp-json' } } });
    vi.spyOn(settingsParser, 'readProjectCommands').mockReturnValue([{ name: 'deploy', content: 'Deploy it' }]);

    const config = store.getProjectConfig('p1');

    expect(config.claudeMd).toBe('# Rules');
    expect(config.projectSettings).toEqual({ mcpServers: { github: { command: 'from-project' } }, project: true });
    expect(config.mcpServers.github.command).toBe('from-mcp-json');
    expect(config.mcpServers.github.toolCallCount).toBe(2);
    expect(config.commands).toEqual([{ name: 'deploy', content: 'Deploy it' }]);
  });

  it('handles live events and debounced updates', async () => {
    const store = makeStore();
    const updated = vi.fn();
    const live = vi.fn();
    store.on('updated', updated);
    store.on('liveEvent', live);

    store.handleLiveEvent({ type: 'session_stop', sessionId: 's1', timestamp: NOW });

    expect(live).toHaveBeenCalledOnce();
    expect(store.getSessions('p1')[0].isActiveSession).toBe(false);
    vi.advanceTimersByTime(250);
    expect(updated).toHaveBeenCalledOnce();
  });

  it('covers empty-state getters and prompt categorization branches', () => {
    const emptyStore = createPopulatedStore([], {});
    expect(emptyStore.getProjectConfig('missing')).toEqual({ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [] });
    expect(emptyStore.getMonthlyTokens()).toBe(0);
    expect(emptyStore.getToolUsageStats()).toEqual([]);
    expect(emptyStore.getStreak()).toEqual({ currentStreak: 0, longestStreak: 0, totalActiveDays: 0 });

    const richProject = makeProject({ id: 'p3', name: 'Gamma', lastActive: NOW });
    const richSession = makeSession({
      id: 'branch-session',
      projectId: 'p3',
      promptCount: 5,
      toolCallCount: 0,
      totalTokens: 100,
      costUsd: 0.01,
      filesModified: [],
      turns: [
        makeTurn({ role: 'user', content: 'Refactor this module', timestamp: NOW }),
        makeTurn({ role: 'user', content: 'Add a new feature', timestamp: NOW - 1 }),
        makeTurn({ role: 'user', content: 'Write coverage tests', timestamp: NOW - 2 }),
        makeTurn({ role: 'user', content: 'Brainstorm roadmap', timestamp: NOW - 3 }),
      ],
    });
    const richStore = createPopulatedStore([richProject], { p3: [richSession] });

    expect(richStore.searchPrompts('   ')).toEqual([]);
    expect(richStore.getPromptPatterns().find((x) => x.category === 'Refactor')?.count).toBe(1);
    expect(richStore.getPromptPatterns().find((x) => x.category === 'Feature')?.count).toBe(1);
    expect(richStore.getPromptPatterns().find((x) => x.category === 'Test')?.count).toBe(1);
    expect(richStore.getPromptPatterns().find((x) => x.category === 'Other')?.count).toBe(1);
    expect(richStore.getProjectStats('p3').promptPatterns.find((x) => x.category === 'Feature')?.count).toBe(1);
    expect(richStore.getProjectStats('p3').promptPatterns.find((x) => x.category === 'Test')?.count).toBe(1);
  });

  it('covers file aggregation, productivity defaults, and no-op live/file updates', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const project = makeProject({ id: 'p4', name: 'Delta', lastActive: NOW });
    const repeated = makeSession({
      id: 'repeat-1',
      projectId: 'p4',
      startTime: NOW - 2 * HOUR,
      filesModified: ['/repo/file.ts'],
      filesCreated: ['/repo/file.ts'],
      toolCallCount: 4,
      totalTokens: 200,
      promptCount: 1,
      turns: [],
    });
    const repeatedAgain = makeSession({
      id: 'repeat-2',
      projectId: 'p4',
      startTime: NOW - HOUR,
      filesModified: ['/repo/file.ts'],
      filesCreated: [],
      toolCallCount: 0,
      totalTokens: 100,
      promptCount: 1,
      turns: [],
    });
    const zeroTime = makeSession({
      id: 'zero-time',
      projectId: 'p4',
      startTime: 0,
      endTime: null,
      durationMs: null,
      totalTokens: 0,
      promptCount: 0,
      toolCallCount: 0,
      filesModified: [],
      turns: [],
    });
    const store = createPopulatedStore([project], { p4: [repeated, repeatedAgain, zeroTime] });
    const updated = vi.fn();
    store.on('updated', updated);

    store.handleLiveEvent({ type: 'notification', timestamp: NOW });
    await store.onFileChanged('/outside/file.jsonl');
    vi.advanceTimersByTime(250);

    expect(store.getHotFiles(5)[0].editCount).toBe(2);
    expect(store.getProjectFiles('p4')[0]).toMatchObject({ type: 'both', editCount: 2, lastTouched: NOW - HOUR });
    expect(store.getProductivityByHour().find((entry) => entry.sessionCount === 0)?.avgToolCalls).toBe(0);
    expect(updated).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it('loads projects from disk, uses cache, and handles pid/subagent helpers', async () => {
    const store = new DashboardStore('/claude', '/cache');
    const parseFile = vi.spyOn((store as any).sessionParser, 'parseFile');
    parseFile.mockImplementation((...args: unknown[]) => {
      const [filePath, projectId] = args as [string, string];
      if (filePath.includes('subagents')) {
        return makeSession({
          id: 'subagent',
          projectId,
          costUsd: 0.3,
          startTime: NOW - 5000,
          turns: [makeTurn({ role: 'assistant', toolCalls: [makeToolCall({ name: 'Read' })] })],
        });
      }
      return makeSession({
        id: 'main-session',
        projectId,
        cwd: '/workspace/demo',
        isActiveSession: false,
        startTime: NOW - 1000,
        endTime: NOW - 500,
        totalTokens: 321,
        costUsd: 0.2,
        promptCount: 1,
        toolCallCount: 1,
        filesModified: ['/workspace/demo/file.ts'],
        turns: [makeTurn({ role: 'assistant', timestamp: NOW - 500, toolCalls: [makeToolCall({ name: 'Read' })] })],
      });
    });

    vi.mocked(fs.existsSync).mockImplementation((target) => {
      const value = String(target);
      return value === '/claude/projects'
        || value === '/claude/projects/demo'
        || value === '/claude/projects/demo/subagents'
        || value === '/claude/sessions'
        || value === '/cache/project-cache.json'
        || value === '/workspace/demo';
    });
    vi.mocked(fs.readdirSync).mockImplementation((target, options?: unknown) => {
      const value = String(target);
      if (value === '/claude/projects') {
        if (options && typeof options === 'object' && 'withFileTypes' in (options as Record<string, unknown>)) {
          return [{ name: 'demo', isDirectory: () => true }] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return ['demo'] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (value === '/claude/projects/demo') {
        return ['session.jsonl', 'notes.txt'] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (value === '/claude/projects/demo/subagents') {
        return ['child.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (value === '/claude/sessions') {
        return ['alive.json', 'dead.json', 'bad.json'] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (value === '/workspace/demo') {
        return ['package.json', 'tsconfig.json', 'pyproject.toml'] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    vi.mocked(fs.statSync).mockImplementation((target) => {
      const value = String(target);
      if (value.endsWith('session.jsonl')) {
        return { mtimeMs: NOW - 2000 } as fs.Stats;
      }
      return { mtimeMs: NOW } as fs.Stats;
    });
    vi.mocked(fs.readFileSync).mockImplementation((target) => {
      const value = String(target);
      if (value === '/cache/project-cache.json') {
        return JSON.stringify({ version: 1, entries: {} }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/alive.json')) {
        return JSON.stringify({ pid: 100, sessionId: 'main-session' }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/dead.json')) {
        return JSON.stringify({ pid: 200, sessionId: 'dead-session' }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/bad.json')) {
        return '{bad' as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('child.jsonl')) {
        return `${JSON.stringify({ parentSessionId: 'main-session' })}\n` as ReturnType<typeof fs.readFileSync>;
      }
      return '' as ReturnType<typeof fs.readFileSync>;
    });
    vi.spyOn(process, 'kill').mockImplementation(((pid: number) => {
      if (pid === 200) {
        throw new Error('dead');
      }
    }) as typeof process.kill);

    await store.initialize();

    expect(store.getProject('demo')).toMatchObject({
      name: 'demo',
      path: '/workspace/demo',
      isActive: true,
      totalCostUsd: 0.5,
      techStack: ['Node.js', 'TypeScript', 'Python'],
    });
    expect(store.getSessions('demo')[0].isActiveSession).toBe(true);
    expect(store.getSessions('demo')[0].subagentCostUsd).toBe(0.3);
    expect(store.getSubagentSessions('demo')).toHaveLength(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/claude/sessions/dead.json');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/cache', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalled();

    parseFile.mockClear();
    vi.mocked(fs.readFileSync).mockImplementation((target) => {
      const value = String(target);
      if (value === '/cache/project-cache.json') {
        return JSON.stringify({
          version: 2,
          entries: {
            demo: {
              cachedAt: NOW + 5000,
              project: makeProject({ id: 'demo', name: 'demo', path: '/workspace/demo', isActive: false }),
              sessions: [makeSession({ id: 'cached-session', projectId: 'demo', isActiveSession: false })],
              subagentSessions: [],
            },
          },
        }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/alive.json')) {
        return JSON.stringify({ pid: 100, sessionId: 'cached-session' }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/dead.json')) {
        return JSON.stringify({ pid: 200, sessionId: 'dead-session' }) as ReturnType<typeof fs.readFileSync>;
      }
      if (value.endsWith('/bad.json')) {
        return '{bad' as ReturnType<typeof fs.readFileSync>;
      }
      return '' as ReturnType<typeof fs.readFileSync>;
    });

    await store.refresh();

    expect(parseFile).not.toHaveBeenCalled();
    expect(store.getSessions('demo')[0].id).toBe('cached-session');
    expect(store.getSessions('demo')[0].isActiveSession).toBe(true);
  });
});
