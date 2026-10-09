import { describe, expect, it } from 'vitest';
import { digestTurns, RECENT_TOOL_CALLS } from '../sessionDigest';
import { makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

describe('digestTurns', () => {
  it('keeps user turns and counts tools and MCP servers', () => {
    const digest = digestTurns([
      makeTurn({ id: 'u1', role: 'user', content: 'Fix it', timestamp: 1 }),
      makeTurn({ role: 'assistant', timestamp: 2, toolCalls: [
        makeToolCall({ name: 'Read' }),
        makeToolCall({ name: 'mcp__github__search', mcpServer: 'github' }),
      ] }),
      makeTurn({ role: 'assistant', timestamp: 3, toolCalls: [makeToolCall({ name: 'Read' })] }),
    ]);

    expect(digest.userTurns.map(t => t.id)).toEqual(['u1']);
    expect(digest.toolCounts).toEqual({ Read: 2, mcp__github__search: 1 });
    expect(digest.mcpCounts).toEqual({ github: 1 });
    expect(digest.lastTurnAt).toBe(3);
  });

  it('keeps the final TodoWrite state', () => {
    const todo = (content: string) => makeToolCall({ name: 'TodoWrite', input: { todos: [{ content, status: 'pending' }] } });
    const digest = digestTurns([
      makeTurn({ role: 'assistant', timestamp: 1, toolCalls: [todo('first')] }),
      makeTurn({ role: 'assistant', timestamp: 2, toolCalls: [todo('second')] }),
    ]);

    expect(digest.lastTodos).toEqual({ todos: [{ content: 'second', status: 'pending' }], timestamp: 2 });
  });

  it('keeps only the newest tool calls, newest first', () => {
    const turns = Array.from({ length: RECENT_TOOL_CALLS + 5 }, (_, i) =>
      makeTurn({ role: 'assistant', timestamp: i, toolCalls: [makeToolCall({ name: `T${i}` })] }));
    const digest = digestTurns(turns);

    expect(digest.recentToolCalls).toHaveLength(RECENT_TOOL_CALLS);
    expect(digest.recentToolCalls[0]).toMatchObject({ tool: `T${RECENT_TOOL_CALLS + 4}`, timestamp: RECENT_TOOL_CALLS + 4 });
  });

  it('describes an empty session', () => {
    expect(digestTurns([])).toEqual({
      userTurns: [], toolCounts: {}, mcpCounts: {}, lastTodos: null, recentToolCalls: [], lastTurnAt: null,
    });
  });
});
