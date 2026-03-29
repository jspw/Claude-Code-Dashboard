import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { mockPostMessage } from '../../__tests__/setup';
import { makeProject, makeSession } from '../../__tests__/fixtures/test-data';
import ProjectDetail from '../ProjectDetail';
import { Project } from '../../types';

describe('ProjectDetail view', () => {
  it('renders fallback when project is missing', () => {
    render(<ProjectDetail project={null as unknown as Project} sessions={[]} />);
    expect(screen.getByText('Project not found.')).toBeInTheDocument();
  });

  it('renders tabs, selects sessions, requests turns, and handles exports', async () => {
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

    fireEvent.click(screen.getByText('Export JSON'));
    fireEvent.click(screen.getByText('Export CSV'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'json' });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'csv' });

    fireEvent.click(screen.getByText('First summary'));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'getSessionTurns', sessionId: 's1' });

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'sessionTurns', sessionId: 's1', turns: [{ id: 't1', role: 'assistant', content: 'Loaded', inputTokens: 0, outputTokens: 0, toolCalls: [], timestamp: Date.now() }] } }));
    });
    expect(screen.getByText('Loaded')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Trends'));
    expect(screen.getByText('Sessions this week')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Files'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    expect(screen.getByText('Rules')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Commands'));
    fireEvent.click(screen.getByText('/deploy'));
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByText('Tool Usage'));
    expect(screen.getByText('Recent Calls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByText('MCP'));
    expect(screen.getByText('github')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByText('Subagents'));
    expect(screen.getByText('Sub task')).toBeInTheDocument();
  });

  it('renders memory, todos, commits, and settings tabs for project metadata', async () => {
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
            {
              fileName: 'working-agreements.md',
              name: 'Working Agreements',
              description: 'Team rules',
              type: 'reference',
              content: '## Agreements\n\n- Always add tests with new features.',
            },
            {
              fileName: 'project-bento.md',
              name: 'Project Bento',
              description: 'Product positioning',
              type: 'project',
              content: '## Product Snapshot\n\n- Focus on composable screenshots.',
            },
          ],
        },
        hooks: [
          { event: 'Stop', command: 'echo stop' },
          { event: 'PostToolUse', matcher: 'Write', command: 'npm test' },
        ],
      }}
      projectStats={{
        usageOverTime: [],
        toolUsage: [],
        promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      }}
      projectFiles={[]}
      projectTodos={[{
        sessionId: 's1',
        sessionDate: now - 10_000,
        sessionSummary: 'Todo session',
        todos: [
          { content: 'Ship feature', status: 'completed' },
          { content: 'Verify docs', status: 'in_progress' },
        ],
        timestamp: now - 5_000,
      }]}
      claudeCommits={[{
        hash: 'abcdef1234567890',
        shortHash: 'abcdef12',
        author: 'Alice',
        date: now - 2_000,
        subject: 'feat: add metadata views',
        filesChanged: 2,
      }]}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByRole('button', { name: /Memory/ }));
    expect(screen.getByText('Project Memory Index')).toBeInTheDocument();
    expect(screen.getByText('Source of Truth')).toBeInTheDocument();
    expect(screen.getByText('Referenced Files')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Working Set' })).toBeInTheDocument();
    expect(screen.getByText('Keep project context current.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Project Bento/ })[0]);
    expect(screen.getByRole('heading', { name: 'Product Snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Focus on composable screenshots.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Working Agreements/ })[0]);
    expect(screen.getByRole('heading', { name: 'Agreements' })).toBeInTheDocument();
    expect(screen.getByText('Always add tests with new features.')).toBeInTheDocument();
    expect(screen.getAllByText('working-agreements.md').length).toBeGreaterThan(0);
    expect(screen.getByText('Referenced In MEMORY.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Workflow/ }));
    expect(screen.getByText('Execution Plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
    expect(screen.getByText('Validate UX')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
    expect(screen.getByText('1 session with saved todo state')).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Ship feature')).toBeInTheDocument();
    expect(screen.getByText('Verify docs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByRole('button', { name: /Commits/ }));
    expect(screen.getByText('1 commit co-authored by Claude')).toBeInTheDocument();
    expect(screen.getByText('feat: add metadata views')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abcdef12' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abcdef1234567890');

    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByRole('button', { name: /Automation/ }));
    expect(screen.getByText('echo stop')).toBeInTheDocument();
    expect(screen.getByText('matcher: Write')).toBeInTheDocument();
    expect(screen.getByText('theme')).toBeInTheDocument();
    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify({ enabled: true }))).toBeInTheDocument();
    expect(screen.queryByText('echo hidden')).not.toBeInTheDocument();
  });

  it('renders empty states across project tabs', () => {
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
        usageOverTime: [],
        toolUsage: [],
        promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      }}
      projectFiles={[]}
      projectTodos={[]}
      claudeCommits={[]}
    />);

    expect(screen.getByText('Select a session to view details')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByText('Subagents'));
    expect(screen.getByText(/No subagent sessions found/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByText('Files'));
    expect(screen.getByText('No file edits recorded yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tool Usage'));
    expect(screen.getAllByText('No tool calls recorded yet.').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByRole('button', { name: /Claude Guide/ }));
    expect(screen.getByText('No CLAUDE.md found in this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Commands'));
    expect(screen.getByText('No custom commands found in .claude/commands/.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MCP'));
    expect(screen.getByText('No MCP servers configured for this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Memory/ }));
    expect(screen.getByText('No memory files found for this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Workflow/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Plans/ })[1]);
    expect(screen.getByText('No plan files found in this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
    expect(screen.getByText('No todo lists found in session history.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    fireEvent.click(screen.getByRole('button', { name: /Commits/ }));
    expect(screen.getByText('No Claude co-authored commits found in this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Setup/ }));
    fireEvent.click(screen.getByRole('button', { name: /Automation/ }));
    expect(screen.getByText('No hooks configured.')).toBeInTheDocument();
    expect(screen.getByText('No project-specific settings found.')).toBeInTheDocument();
  });
});
