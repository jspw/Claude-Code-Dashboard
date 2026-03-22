import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionParser } from '../SessionParser';
import {
  EMPTY_CONTENT,
  MALFORMED_LINES,
  MINIMAL_SESSION,
  MULTI_TURN_SESSION,
  SESSION_ARRAY_CONTENT,
  SESSION_WITH_CACHE,
  SESSION_WITH_COMMAND_MESSAGE,
  SESSION_WITH_MCP,
  SESSION_WITH_THINKING,
  SESSION_WITH_TOOLS,
} from '../../__tests__/fixtures/jsonl-samples';

vi.mock('fs');

const asReadResult = (content: string): ReturnType<typeof fs.readFileSync> =>
  content as unknown as ReturnType<typeof fs.readFileSync>;

describe('SessionParser', () => {
  let parser: SessionParser;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    parser = new SessionParser();
  });

  it('reads cwd from the first valid entry', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(MINIMAL_SESSION));
    expect(parser.readCwd('/tmp/session.jsonl')).toBe('/home/user/project');
  });

  it('returns null for missing cwd or read errors', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(parser.readCwd('/tmp/missing.jsonl')).toBeNull();
  });

  it('returns null for empty sessions', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(EMPTY_CONTENT));
    expect(parser.parseFile('/sessions/abc.jsonl', 'proj-1')).toBeNull();
  });

  it('parses a minimal session', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(MINIMAL_SESSION));
    const result = parser.parseFile('/sessions/abc123.jsonl', 'proj-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('abc123');
    expect(result?.projectId).toBe('proj-1');
    expect(result?.promptCount).toBe(1);
    expect(result?.turns).toHaveLength(2);
    expect(result?.inputTokens).toBe(100);
    expect(result?.outputTokens).toBe(50);
    expect(result?.sessionSummary).toBe('Hello');
    expect(result?.isActiveSession).toBe(false);
    expect(result?.endTime).toBeGreaterThan(0);
  });

  it('extracts array content, strips command messages, and counts prompts', () => {
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(asReadResult(SESSION_ARRAY_CONTENT))
      .mockReturnValueOnce(asReadResult(SESSION_WITH_COMMAND_MESSAGE))
      .mockReturnValueOnce(asReadResult(MULTI_TURN_SESSION));

    const arrayResult = parser.parseFile('/sessions/one.jsonl', 'proj-1');
    const commandResult = parser.parseFile('/sessions/two.jsonl', 'proj-1');
    const multiResult = parser.parseFile('/sessions/three.jsonl', 'proj-1');

    expect(arrayResult?.turns[0].content).toBe('Array content');
    expect(commandResult?.turns[0].content).toBe('Real prompt here');
    expect(commandResult?.sessionSummary).toBe('Real prompt here');
    expect(multiResult?.promptCount).toBe(2);
  });

  it('tracks tool calls, modified files, created files, and MCP server names', () => {
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(asReadResult(SESSION_WITH_TOOLS))
      .mockReturnValueOnce(asReadResult(SESSION_WITH_MCP));

    const toolResult = parser.parseFile('/sessions/tools.jsonl', 'proj-1');
    const mcpResult = parser.parseFile('/sessions/mcp.jsonl', 'proj-1');

    expect(toolResult?.toolCallCount).toBe(2);
    expect(toolResult?.filesModified).toEqual(expect.arrayContaining(['/src/index.ts', '/src/new.ts']));
    expect(toolResult?.filesCreated).toEqual(['/src/new.ts']);
    expect(mcpResult?.turns[1].toolCalls[0].mcpServer).toBe('github');
  });

  it('tracks cache usage, thinking tokens, and cost details', () => {
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(asReadResult(SESSION_WITH_CACHE))
      .mockReturnValueOnce(asReadResult(SESSION_WITH_THINKING));

    const cacheResult = parser.parseFile('/sessions/cache.jsonl', 'proj-1');
    const thinkingResult = parser.parseFile('/sessions/thinking.jsonl', 'proj-1');

    expect(cacheResult?.totalTokens).toBe(3500);
    expect(cacheResult?.cacheCreationTokens).toBe(2000);
    expect(cacheResult?.cacheReadTokens).toBe(15000);
    expect(cacheResult?.cacheHitRate).toBe(83.3);
    expect(cacheResult?.costUsd).toBeGreaterThan(0);
    expect(thinkingResult?.hasThinking).toBe(true);
    expect(thinkingResult?.thinkingTokens).toBe(5000);
  });

  it('computes idle, active, and duration metrics', () => {
    const idleSession = [
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2025-01-15T10:00:00Z', cwd: '/test', message: { content: 'Q1' } }),
      JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2025-01-15T10:01:00Z', message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'A1' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'stop_sequence' } }),
      JSON.stringify({ type: 'user', uuid: 'u2', timestamp: '2025-01-15T10:11:00Z', message: { content: 'Q2' } }),
      JSON.stringify({ type: 'assistant', uuid: 'a2', timestamp: '2025-01-15T10:12:00Z', message: { model: 'claude-sonnet-4', content: [{ type: 'text', text: 'A2' }], usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'stop_sequence' } }),
    ].join('\n');
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(idleSession));

    const result = parser.parseFile('/sessions/idle.jsonl', 'proj-1');

    expect(result?.idleTimeMs).toBe(600000);
    expect(result?.durationMs).toBe(720000);
    expect(result?.activeTimeMs).toBe(120000);
    expect(result?.activityRatio).toBe(16.7);
    expect(result?.isActiveSession).toBe(false);
  });

  it('handles malformed lines without throwing', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(asReadResult(MALFORMED_LINES));
    const result = parser.parseFile('/sessions/bad.jsonl', 'proj-1');

    expect(result).not.toBeNull();
    expect(result?.cwd).toBe('/test');
    expect(result?.turns).toHaveLength(1);
  });
});
