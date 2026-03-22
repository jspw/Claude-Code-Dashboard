import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPopulatedStore } from '../../__tests__/helpers/store-helpers';
import { makeProject, makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

describe('DashboardStore', () => {
  const NOW = new Date('2025-01-15T12:00:00Z').getTime();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  beforeEach(() => {
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
    const settingsParser = (store as any).settingsParser;
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
});
