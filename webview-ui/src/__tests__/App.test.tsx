import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from './helpers/render-helpers';
import { makeProject, makeSession, makeStats } from './fixtures/test-data';
import App from '../App';

describe('App', () => {
  it('renders dashboard by default and merges stateUpdate/liveEvent messages', async () => {
    (window as any).__INITIAL_VIEW__ = 'dashboard';
    (window as any).__INITIAL_DATA__ = { projects: [], stats: makeStats({ totalProjects: 0, activeSessionCount: 0 }) };
    render(<App />);
    expect(screen.getByText('Claude Code Dashboard')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'stateUpdate', payload: { projects: [makeProject({ name: 'Alpha' })] } } }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'liveEvent', payload: { stats: makeStats({ activeSessionCount: 5 }) } } }));
    });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText(/5 active sessions/)).toBeInTheDocument();
  });

  it('renders sidebar and project views from initial globals', () => {
    (window as any).__INITIAL_VIEW__ = 'sidebar';
    (window as any).__INITIAL_DATA__ = { projects: [makeProject({ name: 'Sidebar Project' })], stats: makeStats() };
    const { unmount } = render(<App />);
    expect(screen.getByText('Sidebar Project')).toBeInTheDocument();

    unmount();
    (window as any).__INITIAL_VIEW__ = 'project';
    (window as any).__INITIAL_DATA__ = { project: makeProject({ name: 'Project View' }), sessions: [makeSession({ sessionSummary: 'Summary' })] };
    render(<App />);
    expect(screen.getByText('Project View')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});
