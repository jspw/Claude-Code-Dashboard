import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from './helpers/render-helpers';
import { makeProject, makeSession, makeStats } from './fixtures/test-data';
import App from '../App';

type TestWindow = Window & {
  __INITIAL_VIEW__: string;
  __INITIAL_DATA__: unknown;
};

describe('App', () => {
  it('renders dashboard by default, merges stateUpdate, and ignores raw liveEvent payloads', async () => {
    const testWindow = window as TestWindow;
    testWindow.__INITIAL_VIEW__ = 'dashboard';
    testWindow.__INITIAL_DATA__ = { projects: [], stats: makeStats({ totalProjects: 0, activeSessionCount: 0 }) };
    render(<App />);
    expect(screen.getByText('Claude Code Dashboard')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'stateUpdate', payload: { projects: [makeProject({ name: 'Alpha' })], stats: makeStats({ totalProjects: 1, activeSessionCount: 5 }) } } }));
      // Raw hook event: must NOT be spread into state (would corrupt the root)
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'liveEvent', payload: { type: 'PostToolUse', tool: 'Bash', stats: makeStats({ activeSessionCount: 99 }) } } }));
    });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText(/5 active sessions/)).toBeInTheDocument();
    expect(screen.queryByText(/99 active sessions/)).not.toBeInTheDocument();
  });

  it('renders sidebar and project views from initial globals', () => {
    const testWindow = window as TestWindow;
    testWindow.__INITIAL_VIEW__ = 'sidebar';
    testWindow.__INITIAL_DATA__ = { projects: [makeProject({ name: 'Sidebar Project' })], stats: makeStats() };
    const { unmount } = render(<App />);
    expect(screen.getByText('Sidebar Project')).toBeInTheDocument();

    unmount();
    testWindow.__INITIAL_VIEW__ = 'project';
    testWindow.__INITIAL_DATA__ = { project: makeProject({ name: 'Project View' }), sessions: [makeSession({ sessionSummary: 'Summary' })] };
    render(<App />);
    expect(screen.getByText('Project View')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});
