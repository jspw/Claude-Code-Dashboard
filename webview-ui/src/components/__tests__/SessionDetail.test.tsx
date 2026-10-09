import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../__tests__/helpers/render-helpers';
import { makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/test-data';
import { mockPostMessage } from '../../__tests__/setup';
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

  it('renders @-tagged file chips on user turns', () => {
    const session = makeSession({
      turns: [
        makeTurn({
          role: 'user',
          content: 'Review @docs/plan.md please',
          attachments: [{ path: '/home/user/project/docs/plan.md', displayPath: 'docs/plan.md' }],
          timestamp: 1,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);
    const chip = screen.getByText('docs/plan.md');
    expect(chip).toBeInTheDocument();
    expect(chip.closest('span[title]')).toHaveAttribute('title', '/home/user/project/docs/plan.md');
  });

  it('defaults long messages to a short preview with a show-more toggle', () => {
    const longContent = 'word '.repeat(2000).trim(); // ~10k chars
    const session = makeSession({
      turns: [makeTurn({ role: 'user', content: longContent, timestamp: 1 })],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    const toggle = screen.getByText(`Show more (${(longContent.length - 300).toLocaleString()} more chars)`);
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('parses skill-injection content into a skill event', () => {
    const skill = parseSystemContent('Base directory for this skill: /Users/me/.claude/skills/graphify\n\n# graphify\n\nDoes things.');
    expect(skill).toEqual({ kind: 'skill', name: 'graphify', body: '# graphify\n\nDoes things.' });
  });

  it('renders a skill-injection turn as collapsed context, not a user message', () => {
    const body = 'x'.repeat(9000);
    const session = makeSession({
      turns: [makeTurn({
        role: 'user',
        content: `Base directory for this skill: /Users/me/.claude/skills/dataviz\n\n# Data Viz\n\n${body}`,
        timestamp: 1,
      })],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getByText('Skill loaded')).toBeInTheDocument();
    expect(screen.getByText('dataviz')).toBeInTheDocument();
    // Collapsed by default — body not rendered until expanded.
    expect(screen.queryByText('Data Viz')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show context'));
    expect(screen.getByText('Data Viz')).toBeInTheDocument();
  });

  it('renders cache, thinking, subagent cost, and tool call timeline rows', () => {
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
          content: 'Reading the file now.',
          inputTokens: 5,
          outputTokens: 0,
          toolCalls: [makeToolCall({ name: 'WebSearch', input: { query: 'react hooks' } })],
          timestamp: 2,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getByText('Opus')).toBeInTheDocument();
    expect(screen.getByText('+300 cached')).toBeInTheDocument();
    expect(screen.getByText('50% cache')).toBeInTheDocument();
    expect(screen.getByText(/\+\$0.125 subagents/)).toBeInTheDocument();
    expect(screen.getByText(/thinking \(1.2k\)/)).toBeInTheDocument();
    expect(screen.getByText('Copy resume command')).toBeInTheDocument();
    expect(screen.getByText('github/search')).toBeInTheDocument();
    expect(screen.getByText('repo:foo bug')).toBeInTheDocument();
    // consecutive assistant turns aggregate into one group token footer
    expect(screen.getByText('15↑ 20↓')).toBeInTheDocument();
    // camelCase tool names get the extension-style spaced label
    expect(screen.getByText('Web Search')).toBeInTheDocument();
    expect(screen.getByText('Reading the file now.')).toBeInTheDocument();
  });

  it('shows tool file paths relative to the project root', () => {
    const session = makeSession({
      cwd: '/home/user/project',
      turns: [
        makeTurn({
          role: 'assistant',
          content: '',
          toolCalls: [
            makeToolCall({ name: 'Read', input: { file_path: '/home/user/project/src/index.ts' } }),
            makeToolCall({ name: 'Edit', input: { file_path: '/etc/hosts' } }),
          ],
          timestamp: 1,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    // files outside the project keep the full path
    expect(screen.getByText('/etc/hosts')).toBeInTheDocument();
  });

  it('copies the session ID and shows the failed state when the clipboard rejects', async () => {
    const session = makeSession({ pricingConfidence: 'fallback', turns: [] });
    render(<SessionDetail session={session} turns={[]} loading={false} />);

    // fallback pricing is flagged with an asterisk
    expect(screen.getByText(/est\.\*/)).toBeInTheDocument();

    const chip = screen.getByLabelText('Copy session ID');
    await act(async () => {
      fireEvent.click(chip);
    });
    await waitFor(() => expect(screen.getByText('copied')).toBeInTheDocument());

    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    await act(async () => {
      fireEvent.click(chip);
    });
    await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
  });

  it('renders a collapsed Thought row that expands to the thinking text', () => {
    const session = makeSession({
      turns: [
        makeTurn({
          role: 'assistant',
          content: 'Answer.',
          thinking: 'Let me reason about this problem first.',
          timestamp: 1,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getByText('Thought')).toBeInTheDocument();
    expect(screen.queryByText('Let me reason about this problem first.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Thought'));
    expect(screen.getByText('Let me reason about this problem first.')).toBeInTheDocument();
  });

  it('renders tool outputs in an OUT box with expand for long output', () => {
    const longOutput = 'line '.repeat(100).trim(); // ~600 chars
    const session = makeSession({
      turns: [
        makeTurn({
          role: 'assistant',
          content: '',
          toolCalls: [
            makeToolCall({ name: 'Bash', input: { command: 'ls' }, output: 'file1.ts\nfile2.ts' }),
            makeToolCall({ name: 'Grep', input: { pattern: 'foo' }, output: longOutput }),
          ],
          timestamp: 1,
        }),
      ],
    });

    render(<SessionDetail session={session} turns={session.turns} loading={false} />);

    expect(screen.getAllByText('OUT')).toHaveLength(2);
    expect(screen.getByText(/file1\.ts/)).toBeInTheDocument();

    // long output is truncated until clicked
    expect(screen.queryByText(longOutput)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Show full output'));
    expect(screen.getByText(longOutput)).toBeInTheDocument();
  });
});

describe('SessionDetail — files touched', () => {
  const manyFiles = Array.from({ length: 20 }, (_, i) => `/src/file-${i}.ts`);
  const renderWithFiles = (filesModified: string[]) => render(
    <SessionDetail session={makeSession({ filesModified, filesCreated: [], turns: [] })} turns={[]} loading={false} />
  );

  it('previews a long list instead of letting it take over the panel', () => {
    renderWithFiles(manyFiles);

    expect(screen.getByText('Files touched · 20')).toBeInTheDocument();
    expect(screen.getByText('file-7.ts')).toBeInTheDocument();
    expect(screen.queryByText('file-8.ts')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+12 more' })).toBeInTheDocument();
  });

  it('expands to every file and collapses back', () => {
    renderWithFiles(manyFiles);

    fireEvent.click(screen.getByRole('button', { name: '+12 more' }));
    expect(screen.getByText('file-19.ts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('file-19.ts')).not.toBeInTheDocument();
  });

  it('opens a file when its chip is clicked', () => {
    renderWithFiles(['/repo/src/a.ts']);

    fireEvent.click(screen.getByRole('button', { name: 'a.ts' }));
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'openFile', path: '/repo/src/a.ts' });
  });

  it('tells same-named files apart by their folder', () => {
    renderWithFiles(['/repo/src/share/index.ts', '/repo/src/parsers/index.ts', '/repo/src/a.ts']);

    expect(screen.getByText('share/index.ts')).toBeInTheDocument();
    expect(screen.getByText('parsers/index.ts')).toBeInTheDocument();
    expect(screen.getByText('a.ts')).toBeInTheDocument();
  });

  it('shows a short list in full, with no toggle', () => {
    renderWithFiles(['/src/a.ts', '/src/b.ts']);

    expect(screen.getByText('Files touched · 2')).toBeInTheDocument();
    expect(screen.getByText('b.ts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more|Show less/ })).not.toBeInTheDocument();
  });
});

describe('SessionDetail — replies only', () => {
  it('switches the conversation between the full timeline and replies only', () => {
    const turns = [
      makeTurn({ role: 'user', content: 'Fix it' }),
      makeTurn({ role: 'assistant', content: 'Done.', toolCalls: [makeToolCall({ name: 'WebFetch', input: { url: 'https://example.com' } })] }),
    ];
    render(<SessionDetail session={makeSession({ turns })} turns={turns} loading={false} />);
    expect(screen.getByText('Web Fetch')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Replies only' }));
    expect(screen.queryByText('Web Fetch')).not.toBeInTheDocument();
    expect(screen.getByText('Done.')).toBeInTheDocument();
    expect(screen.getByText('Fix it')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Full timeline' }));
    expect(screen.getByText('Web Fetch')).toBeInTheDocument();
  });
});
