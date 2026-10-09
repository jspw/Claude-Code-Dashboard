import type { Turn } from '../store/DashboardStore';

export const RECENT_TOOL_CALLS = 60;

export interface RecentToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: number;
}

/**
 * Everything the dashboard's analytics read from a session's turns. Holding
 * this instead of the turns keeps tool output, assistant text and thinking —
 * nearly all of the bytes — on disk until someone opens the session.
 */
export interface SessionDigest {
  userTurns: Turn[];                                         // prompt search, all prompts, prompt patterns
  toolCounts: Record<string, number>;                        // tool usage, weekly recap, project stats
  mcpCounts: Record<string, number>;                         // MCP server call counts
  lastTodos: { todos: unknown[]; timestamp: number } | null; // final TodoWrite state
  recentToolCalls: RecentToolCall[];                         // newest first, at most RECENT_TOOL_CALLS
  lastTurnAt: number | null;                                 // project "last active"
}

export function digestTurns(turns: Turn[]): SessionDigest {
  const toolCounts: Record<string, number> = {};
  const mcpCounts: Record<string, number> = {};
  const calls: RecentToolCall[] = [];
  let lastTodos: SessionDigest['lastTodos'] = null;

  for (const turn of turns) {
    for (const tc of turn.toolCalls) {
      toolCounts[tc.name] = (toolCounts[tc.name] ?? 0) + 1;
      if (tc.mcpServer) { mcpCounts[tc.mcpServer] = (mcpCounts[tc.mcpServer] ?? 0) + 1; }
      if (tc.name === 'TodoWrite' && Array.isArray(tc.input?.todos)) {
        lastTodos = { todos: tc.input.todos as unknown[], timestamp: turn.timestamp };
      }
      calls.push({ tool: tc.name, input: tc.input, timestamp: turn.timestamp });
    }
  }

  calls.sort((a, b) => b.timestamp - a.timestamp);
  return {
    userTurns: turns.filter(t => t.role === 'user'),
    toolCounts,
    mcpCounts,
    lastTodos,
    recentToolCalls: calls.slice(0, RECENT_TOOL_CALLS),
    lastTurnAt: turns.length > 0 ? turns[turns.length - 1].timestamp : null,
  };
}
