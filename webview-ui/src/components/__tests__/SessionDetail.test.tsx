import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../__tests__/helpers/render-helpers';
import { makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/test-data';
import SessionDetail, { modelBadgeColor, modelLabel, parseSystemContent, stripAnsi } from '../SessionDetail';

describe('SessionDetail', () => {
  it('renders loading, system events, tool calls, and clipboard copy', async () => {
    const session = makeSession({
      model: 'claude-sonnet-4',
      turns: [
        makeTurn({ role: 'user', content: '<command-name>npm</command-name><command-args>test</command-args>', timestamp: 1 }),
        makeTurn({ role: 'user', content: '<command-stdout>\x1b[31moutput\x1b[0m</command-stdout>', timestamp: 2 }),
        makeTurn({ role: 'assistant', content: 'Done', toolCalls: [
          makeToolCall({ name: 'Agent', input: { prompt: 'Investigate bug' } }),
          makeToolCall({ name: 'Edit', input: { file_path: '/src/index.ts' } }),
        ], timestamp: 3 }),
      ],
    });

    const { rerender } = render(<SessionDetail session={session} turns={session.turns} loading={true} />);
    expect(screen.getByText('Loading turns...')).toBeInTheDocument();

    rerender(<SessionDetail session={session} turns={session.turns} loading={false} />);
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('output')).toBeInTheDocument();
    expect(screen.getByText('Investigate bug')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();

    const copyButtons = screen.getAllByRole('button');
    await act(async () => {
      fireEvent.click(copyButtons.find((button) => button.getAttribute('title') === 'Copy')!);
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('renders no-turns state and created file badges', () => {
    const session = makeSession({
      model: 'claude-haiku-4',
      filesModified: ['/src/new.ts'],
      filesCreated: ['/src/new.ts'],
      turns: [],
    });

    render(<SessionDetail session={session} turns={[]} loading={false} />);
    expect(screen.getByText('No turns recorded for this session.')).toBeInTheDocument();
    expect(screen.getByText(/new.ts/)).toBeInTheDocument();
    expect(screen.getByText('Haiku')).toBeInTheDocument();
  });

  it('covers parsing and model helper branches', () => {
    expect(stripAnsi('\u001b[31mhello\u001b[0m')).toBe('hello');
    expect(parseSystemContent('<local-command-caveat>note</local-command-caveat>')).toBe('skip');
    expect(parseSystemContent('<command-name>git</command-name>')).toEqual({ kind: 'command', name: 'git', args: undefined });
    expect(parseSystemContent('<local-command-stdout>\u001b[31mwarn\u001b[0m</local-command-stdout>')).toEqual({ kind: 'stdout', text: 'warn' });
    expect(parseSystemContent('<command-stdout>   </command-stdout>')).toBe('skip');
    expect(parseSystemContent('plain text')).toBeNull();

    expect(modelLabel('claude-opus-4')).toBe('Opus');
    expect(modelLabel('claude-haiku-4')).toBe('Haiku');
    expect(modelLabel('claude-sonnet-4')).toBe('Sonnet');
    expect(modelLabel('claude-unknown')).toBeNull();
    expect(modelLabel(null)).toBeNull();

    expect(modelBadgeColor('claude-opus-4')).toContain('text-purple-400');
    expect(modelBadgeColor('claude-haiku-4')).toContain('text-orange-400');
    expect(modelBadgeColor('claude-sonnet-4')).toContain('text-blue-400');
    expect(modelBadgeColor(null)).toBe('');
  });

  it('renders cache, thinking, subagent cost, collapsed previews, and tool-only assistant turns', () => {
    const longContent = 'A'.repeat(140);
    const session = makeSession({
      model: 'claude-opus-4',
      cacheReadTokens: 300,
      cacheHitRate: 50,
      hasThinking: true,
      thinkingTokens: 1200,
      subagentCostUsd: 0.125,
      costUsd: 0.375,
      turns: [
        makeTurn({
          role: 'assistant',
          content: '',
          inputTokens: 10,
          outputTokens: 20,
          toolCalls: [makeToolCall({ name: 'mcp__github__search', input: { query: 'repo:foo bug' } })],
          timestamp: 1,
        }),
        makeTurn({
          role: 'assistant',
          content: longContent,
          inputTokens: 5,
          outputTokens: 0,
          toolCalls: [makeToolCall({ name: 'Read', input: { file_path: '/tmp/file.ts' } })],
          timestamp: 2,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getByText('Opus')).toBeInTheDocument();
    expect(screen.getByText('+300 cached')).toBeInTheDocument();
    expect(screen.getByText('50% cache')).toBeInTheDocument();
    expect(screen.getByText(/\+\$0.1250 subagents/)).toBeInTheDocument();
    expect(screen.getByText(/\u26a1 thinking/)).toBeInTheDocument();
    expect(screen.getByText('github/search')).toBeInTheDocument();
    expect(screen.getByText('repo:foo bug')).toBeInTheDocument();
    expect(screen.getByText('10↑ 20↓')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Collapse')[0]);
    expect(screen.getByText(`${longContent.slice(0, 120)}…`)).toBeInTheDocument();
  });
});
