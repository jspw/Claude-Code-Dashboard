import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makeToolCall, makeTurn } from '../../__tests__/fixtures/test-data';
import { ConversationTurn } from '../conversation/ConversationTurn';
import { SystemEventRow } from '../conversation/SystemEventRow';
import { AgentCallBlock } from '../conversation/AgentCallBlock';
import { ResponseGroup } from '../conversation/ResponseGroup';
import { ToolCallRow, relativizeHint, toolDisplayName, toolHint } from '../conversation/ToolCallRow';

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
