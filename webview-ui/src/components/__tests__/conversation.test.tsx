import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeToolCall, makeTurn } from '../../__tests__/fixtures/test-data';
import { ConversationTurn } from '../conversation/ConversationTurn';
import { SystemEventRow } from '../conversation/SystemEventRow';
import { AgentCallBlock } from '../conversation/AgentCallBlock';
import { ResponseGroup } from '../conversation/ResponseGroup';
import { ToolCallRow, relativizeHint, toolDisplayName, toolHint } from '../conversation/ToolCallRow';
import { QuestionsBlock, resolveAnswer } from '../conversation/QuestionsBlock';

describe('conversation components', () => {
  it('renders nothing for empty turns and caveat-only user turns', () => {
    const { container: empty } = render(
      <ConversationTurn turn={makeTurn({ role: 'user', content: '', timestamp: 1 })} />,
    );
    expect(empty).toBeEmptyDOMElement();

    const { container: caveat } = render(
      <ConversationTurn turn={makeTurn({ role: 'user', content: '<local-command-caveat>note</local-command-caveat>', timestamp: 1 })} />,
    );
    expect(caveat).toBeEmptyDOMElement();
  });

  it('renders an attachments-only user turn as a prompt card', () => {
    render(
      <ConversationTurn
        turn={makeTurn({
          role: 'user',
          content: '',
          attachments: [{ path: '/repo/a.md', displayPath: 'a.md' }],
          timestamp: 1,
        })}
      />,
    );
    expect(screen.getByText('a.md')).toBeInTheDocument();
  });

  it('renders command rows without args and nothing for unknown event kinds', () => {
    render(<ConversationTurn turn={makeTurn({ role: 'user', content: '<command-name>clear</command-name>', timestamp: 1 })} />);
    expect(screen.getByText('clear')).toBeInTheDocument();

    const { container } = render(
      <SystemEventRow event={{ kind: 'skill', name: 's', body: 'b' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('collapses agent blocks to a preview and handles missing prompts', () => {
    const prompt = 'P'.repeat(140);
    render(<AgentCallBlock tc={makeToolCall({ name: 'Agent', input: { prompt } })} />);
    fireEvent.click(screen.getByTitle('Collapse'));
    expect(screen.getByText(`${prompt.slice(0, 120)}…`)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Expand'));
    expect(screen.getByText(prompt)).toBeInTheDocument();

    render(<AgentCallBlock tc={makeToolCall({ name: 'Agent', input: {} })} />);
    expect(screen.getAllByText('subagent').length).toBeGreaterThan(0);
  });

  it('derives tool labels, input hints, and relative paths', () => {
    expect(toolDisplayName('WebSearch')).toBe('Web Search');
    expect(toolDisplayName('Bash')).toBe('Bash');
    expect(toolDisplayName('mcp__github__search')).toBe('github/search');
    expect(toolHint(makeToolCall({ input: { url: 'https://example.com' } }))).toBe('https://example.com');
    expect(toolHint(makeToolCall({ input: {} }))).toBe('');

    expect(relativizeHint('/repo/src/a.ts', '/repo')).toBe('src/a.ts');
    expect(relativizeHint('/elsewhere/b.ts', '/repo')).toBe('/elsewhere/b.ts');
    expect(relativizeHint('/repo/src/a.ts', null)).toBe('/repo/src/a.ts');

    render(<ToolCallRow tc={makeToolCall({ name: 'WebFetch', input: { url: 'https://example.com' } })} />);
    expect(screen.getByText('Web Fetch')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('renders nothing for a response group with no visible rows', () => {
    const { container } = render(
      <ResponseGroup turns={[makeTurn({ role: 'assistant', content: '', inputTokens: 0, outputTokens: 0, timestamp: 1 })]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows short tool output without an expand affordance', () => {
    render(<ToolCallRow tc={makeToolCall({ name: 'Bash', input: { command: 'ls' }, output: 'ok' })} />);
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.queryByTitle('Show full output')).not.toBeInTheDocument();
  });
});

describe('ResponseGroup — replies only', () => {
  const turns = () => [
    makeTurn({ id: 'a1', role: 'assistant', content: 'Looking into it.', thinking: 'hmm', timestamp: 1, toolCalls: [
      makeToolCall({ id: 'tc1', name: 'WebFetch', input: { url: 'https://example.com' } }),
      makeToolCall({ id: 'tc2', name: 'WebFetch', input: { url: 'https://example.org' } }),
    ] }),
    makeTurn({ id: 'a2', role: 'assistant', content: 'Here is the answer.', timestamp: 2 }),
  ];

  it('shows only the final reply and folds everything before it into one row', () => {
    render(<ResponseGroup turns={turns()} repliesOnly />);

    expect(screen.getByText('Here is the answer.')).toBeInTheDocument();
    expect(screen.queryByText('Looking into it.')).not.toBeInTheDocument();
    expect(screen.queryByText('Web Fetch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 tool calls · 1 message · 1 thought/ })).toBeInTheDocument();
  });

  it("expands one response's hidden steps on click", () => {
    render(<ResponseGroup turns={turns()} repliesOnly />);

    fireEvent.click(screen.getByRole('button', { name: /2 tool calls/ }));
    expect(screen.getByText('Looking into it.')).toBeInTheDocument();
    expect(screen.getAllByText('Web Fetch')).toHaveLength(2);
  });

  it('shows replies in full rather than as a preview', () => {
    const long = `${'word '.repeat(150)}THE END`;
    const group = (repliesOnly: boolean) =>
      <ResponseGroup repliesOnly={repliesOnly} turns={[makeTurn({ id: 'r1', role: 'assistant', content: long })]} />;
    const { rerender } = render(group(false));
    expect(screen.getByRole('button', { name: /Show more/ })).toBeInTheDocument();

    rerender(group(true));
    expect(screen.getByText(/THE END/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('still marks a response that had no reply text', () => {
    render(<ResponseGroup repliesOnly turns={[
      makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'WebFetch', input: { url: 'https://x.dev' } })] }),
    ]} />);

    expect(screen.getByRole('button', { name: /1 tool call$/ })).toBeInTheDocument();
  });

  it('shows the full timeline by default', () => {
    render(<ResponseGroup turns={turns()} />);

    expect(screen.getAllByText('Web Fetch')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /tool calls/ })).not.toBeInTheDocument();
  });
});

describe('QuestionsBlock', () => {
  const input = {
    questions: [
      {
        question: 'What should the badge say?',
        header: 'Badge',
        multiSelect: false,
        options: [
          { label: 'Open to contract work', description: 'Fits the Services page' },
          { label: 'Keep shipping', description: 'Leave it as it is' },
        ],
      },
      {
        question: 'Which extras?',
        header: 'Extras',
        multiSelect: true,
        options: [{ label: 'Maps, live' }, { label: 'Ticker' }, { label: 'Signboards' }],
      },
    ],
  };

  it('marks the picked options and shows typed text as Other', () => {
    render(<QuestionsBlock tc={makeToolCall({
      name: 'AskUserQuestion',
      input,
      output: 'Your questions have been answered: ...',
      answers: {
        'What should the badge say?': { answer: 'Open for collaboration, not job hunting', notes: 'Keep it subtle' },
        'Which extras?': { answer: 'Maps, live, Signboards' },
      },
    })} />);

    expect(screen.getByText('Answered · 2 questions')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Other Open for collaboration/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Keep shipping/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Keep it subtle')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Maps, live' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Signboards' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Ticker' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('button', { name: /Questions/ }));
    expect(screen.queryByText('What should the badge say?')).not.toBeInTheDocument();
  });

  it('shows a dismissed question set without answers', () => {
    render(<QuestionsBlock tc={makeToolCall({
      name: 'AskUserQuestion',
      input,
      output: "The user doesn't want to proceed with this tool use.",
    })} />);

    expect(screen.getByText('Dismissed · 2 questions')).toBeInTheDocument();
    expect(screen.getAllByText('No answer')).toHaveLength(2);
  });

  it('resolves multi-select answers whose labels contain commas', () => {
    const q = input.questions[1];
    const { picked, other } = resolveAnswer(q, 'Maps, live, Ticker, my own idea');
    expect([...picked]).toEqual(['Maps, live', 'Ticker']);
    expect(other).toBe('my own idea');
  });

  it('renders inside the response timeline instead of a plain tool row', () => {
    render(<ResponseGroup turns={[
      makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'AskUserQuestion', input })] }),
    ]} />);

    expect(screen.getByText('Waiting for answer · 2 questions')).toBeInTheDocument();
    expect(screen.queryByText('Ask User Question')).not.toBeInTheDocument();
  });
});
