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

    fireEvent.click(screen.getByText('Weekly'));
    expect(screen.getByText('Sessions this week')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CLAUDE.md'));
    expect(screen.getByText('Rules')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Commands'));
    fireEvent.click(screen.getByText('/deploy'));
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('Recent Calls')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MCP Servers'));
    expect(screen.getByText('github')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Subagents'));
    expect(screen.getByText('Sub task')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Files'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });

  it('renders empty states across project tabs', () => {
    render(<ProjectDetail
      project={makeProject({ name: 'Empty Project', isActive: false, techStack: [] })}
      sessions={[]}
      subagentSessions={[]}
      config={{ claudeMd: null, mcpServers: {}, projectSettings: {}, commands: [] }}
      projectStats={{
        usageOverTime: [],
        toolUsage: [],
        promptPatterns: [],
        efficiency: { avgTokensPerPrompt: 0, avgToolCallsPerSession: 0, avgSessionDurationMin: 0, firstTurnResolutionRate: 0, avgActiveRatio: 0 },
        recentToolCalls: [],
        weeklyStats: { sessions: 0, tokens: 0, costUsd: 0, dailyBreakdown: [] },
      }}
      projectFiles={[]}
    />);

    expect(screen.getByText('Select a session to view details')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Subagents'));
    expect(screen.getByText(/No subagent sessions found/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Files'));
    expect(screen.getByText('No file edits recorded yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getAllByText('No tool calls recorded yet.').length).toBe(2);
    fireEvent.click(screen.getByText('CLAUDE.md'));
    expect(screen.getByText('No CLAUDE.md found in this project.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Commands'));
    expect(screen.getByText('No custom commands found in .claude/commands/.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MCP Servers'));
    expect(screen.getByText('No MCP servers configured for this project.')).toBeInTheDocument();
  });
});
