import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { mockPostMessage } from '../../__tests__/setup';
import { makeProject, makeSession } from '../../__tests__/fixtures/test-data';
import ProjectDetail from '../ProjectDetail';
import { Project } from '../../types';

// Click a top-level tab by its label. Anchor on a trailing space (badge count)
// or end-of-name so "Work" doesn't also match "Working Agreements".
function clickTab(name: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}\\s*\\d*$`) }));
}

describe('ProjectDetail view', () => {
  it('renders fallback when project is missing', () => {
    render(<ProjectDetail project={null as unknown as Project} sessions={[]} />);
    expect(screen.getByText('Project not found.')).toBeInTheDocument();
  });

  it('renders 5 tabs, selects sessions, requests turns, and handles exports', async () => {
    const project = makeProject({ isActive: true, techStack: ['TypeScript', 'React'] });
    const sessions = [
      makeSession({ id: 's1', sessionSummary: 'First summary', turns: [] }),
      makeSession({ id: 's2', startTime: Date.now() - 5000, sessionSummary: 'Second summary', turns: [] }),
    ];

    render(<ProjectDetail
      project={project}
      sessions={sessions}
      subagentSessions={[makeSession({ id: 'sub1', parentSessionId: 's1', sessionSummary: 'Sub task', turns: [] })]}
      config={{
        claudeMd: '# Rules',
        mcpServers: { github: { name: 'github', command: 'npx', type: 'stdio', toolCallCount: 2 } },
        projectSettings: {},
        commands: [{ name: 'deploy', content: 'Ship it' }],
        plans: [],
        memory: { index: null, files: [] },
        hooks: [],
      }}
      projectStats={{
        usageOverTime: [],
        toolUsage: [{ tool: 'Read', count: 2, percentage: 100 }],
        promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 100, avgToolCallsPerSession: 2, avgSessionDurationMin: 5, firstTurnResolutionRate: 50, avgActiveRatio: 80 },
        recentToolCalls: [{ tool: 'Read', input: { file_path: '/src/index.ts' }, sessionId: 's1', sessionDate: Date.now(), timestamp: Date.now() }],
        weeklyStats: { sessions: 2, tokens: 5000, costUsd: 0.5, dailyBreakdown: [{ date: '1/15', tokens: 5000, costUsd: 0.5, sessions: 2 }] },
      }}
      projectFiles={[{ file: 'index.ts', fullPath: '/src/index.ts', type: 'modified', editCount: 2, lastTouched: Date.now() }]}
    />);

    expect(screen.getByText(project.name)).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    // Export dropdown
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export JSON'));
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export CSV'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'json' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'csv' });

    // Overview (default) shows recent sessions; clicking one jumps to Sessions and loads turns
    fireEvent.click(screen.getByText('First summary'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'getSessionTurns', sessionId: 's1' });
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'sessionTurns', sessionId: 's1', turns: [{ id: 't1', role: 'assistant', content: 'Loaded', inputTokens: 0, outputTokens: 0, toolCalls: [], timestamp: Date.now() }] } }));
    });
    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText('Copy resume command')).toBeInTheDocument();

    // Activity tab merges trends, files, tools, commits
    clickTab('Activity');
    expect(screen.getByText('Sessions this week')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('Recent calls')).toBeInTheDocument();

    // Setup tab merges CLAUDE.md, commands, MCP
    clickTab('Setup');
    expect(screen.getByText('Rules')).toBeInTheDocument();
    fireEvent.click(screen.getByText('/deploy'));
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('github')).toBeInTheDocument();

    // Subagents live under Sessions as a toggle
    clickTab('Sessions');
    fireEvent.click(screen.getByRole('button', { name: /Subagents \(1\)/ }));
    expect(screen.getByText('Sub task')).toBeInTheDocument();
  });

  it('renders memory, plans, todos, commits, and automation for project metadata', async () => {
    const now = Date.now();

    render(<ProjectDetail
      project={makeProject({ name: 'Metadata Project' })}
      sessions={[makeSession({ id: 's1', sessionSummary: 'Session summary', turns: [] })]}
      config={{
        claudeMd: '# Rules',
        mcpServers: {},
        projectSettings: {
          theme: 'dark',
          nested: { enabled: true },
          hooks: { Stop: [{ command: 'echo hidden' }] },
          mcpServers: { local: { command: 'npx' } },
        },
        commands: [],
        plans: [{
          fileName: 'PLAN.md',
          name: 'Execution Plan',
          description: 'Current delivery sequence',
          content: '## Milestones\n\n1. Validate UX\n2. Build dashboard polish',
        }],
        memory: {
          index: '# Memory\n\n[Working Agreements](working-agreements.md) - Team rules\n[Project Bento](project-bento.md) - Product positioning\n\n## Working Set\n- Keep project context current.',
          files: [
            { fileName: 'working-agreements.md', name: 'Working Agreements', description: 'Team rules', type: 'reference', content: '## Agreements\n\n- Always add tests with new features.' },
            { fileName: 'project-bento.md', name: 'Project Bento', description: 'Product positioning', type: 'project', content: '## Product Snapshot\n\n- Focus on composable screenshots.' },
          ],
        },
        hooks: [
          { event: 'Stop', command: 'echo stop' },
          { event: 'PostToolUse', matcher: 'Write', command: 'npm test' },
        ],
      }}
      projectStats={{
        usageOverTime: [], toolUsage: [], promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      }}
      projectFiles={[]}
      projectTodos={[{
        sessionId: 's1', sessionDate: now - 10_000, sessionSummary: 'Todo session',
        todos: [{ content: 'Ship feature', status: 'completed' }, { content: 'Verify docs', status: 'in_progress' }],
        timestamp: now - 5_000,
      }]}
      claudeCommits={[{ hash: 'abcdef1234567890', shortHash: 'abcdef12', author: 'Alice', date: now - 2_000, subject: 'feat: add metadata views', filesChanged: 2 }]}
    />);

    // Setup → Memory section
    clickTab('Setup');
    expect(screen.getByRole('heading', { name: 'Working Set' })).toBeInTheDocument();
    expect(screen.getByText('Referenced Files')).toBeInTheDocument();
    expect(screen.getByText('Keep project context current.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Project Bento/ })[0]);
    expect(screen.getByRole('heading', { name: 'Product Snapshot' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Working Agreements/ })[0]);
    expect(screen.getByRole('heading', { name: 'Agreements' })).toBeInTheDocument();
    expect(screen.getByText('Referenced In MEMORY.md')).toBeInTheDocument();

    // Setup → Automation (hooks + non-hidden settings)
    expect(screen.getByText('echo stop')).toBeInTheDocument();
    expect(screen.getByText('matcher: Write')).toBeInTheDocument();
    expect(screen.getByText('theme')).toBeInTheDocument();
    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify({ enabled: true }))).toBeInTheDocument();
    expect(screen.queryByText('echo hidden')).not.toBeInTheDocument();

    // Work → Plans + Todos
    clickTab('Work');
    expect(screen.getByText('Execution Plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
    expect(screen.getByText('Validate UX')).toBeInTheDocument();
    expect(screen.getByText('Ship feature')).toBeInTheDocument();
    expect(screen.getByText('Verify docs')).toBeInTheDocument();

    // Activity → Commits
    clickTab('Activity');
    expect(screen.getByText('feat: add metadata views')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abcdef12' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abcdef1234567890');
  });

  it('renders empty states and hides the Work tab when empty', () => {
    render(<ProjectDetail
      project={makeProject({ name: 'Empty Project', isActive: false, techStack: [] })}
      sessions={[]}
      subagentSessions={[]}
      config={{
        claudeMd: null,
        mcpServers: {},
        projectSettings: { hooks: {}, mcpServers: {} },
        commands: [],
        plans: [],
        memory: { index: null, files: [] },
        hooks: [],
      }}
      projectStats={{
        usageOverTime: [], toolUsage: [], promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      }}
      projectFiles={[]}
      projectTodos={[]}
      claudeCommits={[]}
    />);

    // Work tab is hidden with no plans/todos
    expect(screen.queryByRole('button', { name: /^Work/ })).not.toBeInTheDocument();

    clickTab('Sessions');
    expect(screen.getByText('Select a session to view details')).toBeInTheDocument();

    clickTab('Activity');
    expect(screen.getByText('No file edits recorded yet.')).toBeInTheDocument();
    expect(screen.getAllByText('No tool calls recorded yet.').length).toBe(2);
    expect(screen.getByText('No Claude co-authored commits found.')).toBeInTheDocument();

    clickTab('Setup');
    expect(screen.getByText('No CLAUDE.md found in this project.')).toBeInTheDocument();
    expect(screen.getByText('No custom commands found.')).toBeInTheDocument();
    expect(screen.getByText('No MCP servers configured.')).toBeInTheDocument();
    expect(screen.getByText('No memory files found.')).toBeInTheDocument();
    expect(screen.getByText('No automation configured.')).toBeInTheDocument();
  });
});
