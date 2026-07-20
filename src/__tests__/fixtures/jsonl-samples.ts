/** Raw JSONL strings for parser tests */

export const MINIMAL_SESSION = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Hello' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'Hi!' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_IDE_TAGS = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: {
      content:
        '<ide_opened_file>The user opened the file /home/user/project/package.json in the IDE.</ide_opened_file>' +
        '<ide_selection>The user selected lines 1 to 3</ide_selection>Fix the build script',
    },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'On it.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_ATTACHMENTS = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Review @docs/plan.md and @src/index.ts please' },
  }),
  JSON.stringify({
    type: 'attachment',
    uuid: 'att1',
    timestamp: '2025-01-15T10:00:00Z',
    attachment: {
      type: 'file',
      filename: '/home/user/project/docs/plan.md',
      displayPath: 'docs/plan.md',
      content: { type: 'text', file: { filePath: '/home/user/project/docs/plan.md', content: '# Plan' } },
    },
  }),
  JSON.stringify({
    type: 'attachment',
    uuid: 'att2',
    timestamp: '2025-01-15T10:00:00Z',
    attachment: {
      type: 'file',
      filename: '/home/user/project/src/index.ts',
      displayPath: 'src/index.ts',
      content: { type: 'text', file: { filePath: '/home/user/project/src/index.ts', content: 'export {};' } },
    },
  }),
  JSON.stringify({
    type: 'attachment',
    uuid: 'att3',
    timestamp: '2025-01-15T10:00:00Z',
    attachment: { type: 'skill_listing', skills: [] },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'Reviewed.' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_TOOLS = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Edit index.ts' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [
        { type: 'text', text: 'Let me edit that.' },
        { type: 'tool_use', id: 'tc1', name: 'Edit', input: { file_path: '/src/index.ts' } },
        { type: 'tool_use', id: 'tc2', name: 'Write', input: { file_path: '/src/new.ts' } },
      ],
      usage: { input_tokens: 200, output_tokens: 150, cache_creation_input_tokens: 100, cache_read_input_tokens: 500 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_THINKING = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Think deeply about this' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-opus-4',
      content: [
        { type: 'thinking', thinking_tokens: 5000 },
        { type: 'text', text: 'After thinking...' },
      ],
      usage: { input_tokens: 300, output_tokens: 200 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_MCP = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Use MCP tool' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [
        { type: 'tool_use', id: 'tc1', name: 'mcp__github__search', input: { query: 'test' } },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const EMPTY_CONTENT = '';

export const MALFORMED_LINES = [
  '{ bad json }',
  'not json at all',
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2025-01-15T10:00:00Z', message: { content: 'Valid line' }, cwd: '/test' }),
].join('\n');

export const SESSION_WITH_CACHE = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Cached session' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'Response' }],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 2000,
        cache_read_input_tokens: 15000,
      },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const MULTI_TURN_SESSION = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'First question' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'First answer' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
  JSON.stringify({
    type: 'user',
    uuid: 'u2',
    timestamp: '2025-01-15T10:05:00Z',
    message: { content: 'Second question' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a2',
    timestamp: '2025-01-15T10:06:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'Second answer' }],
      usage: { input_tokens: 200, output_tokens: 100 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_COMMAND_MESSAGE = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: '<command-message>internal</command-message>Real prompt here' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'OK' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_ARRAY_CONTENT = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: [{ type: 'text', text: 'Array content' }, { type: 'image', source: {} }] },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'OK' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');

export const SESSION_WITH_TOOL_RESULTS = [
  JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2025-01-15T10:00:00Z',
    cwd: '/home/user/project',
    message: { content: 'Search the web' },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2025-01-15T10:00:30Z',
    message: {
      model: 'claude-sonnet-4',
      content: [
        { type: 'thinking', thinking: 'Let me plan the search first.', thinking_tokens: 400 },
        { type: 'text', text: 'Searching now.' },
        { type: 'tool_use', id: 'ws1', name: 'WebSearch', input: { query: 'persistent memory' } },
        { type: 'tool_use', id: 'ws2', name: 'Bash', input: { command: 'ls' } },
      ],
      usage: { input_tokens: 200, output_tokens: 100 },
      stop_reason: 'tool_use',
    },
  }),
  JSON.stringify({
    type: 'user',
    uuid: 'tr1',
    timestamp: '2025-01-15T10:00:40Z',
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 'ws1', content: [{ type: 'text', text: '  Result A\nResult B  ' }] },
        { type: 'tool_result', tool_use_id: 'ws2', content: 'file1.ts\nfile2.ts' },
        { type: 'tool_result', tool_use_id: 'unknown-id', content: 'orphan' },
      ],
    },
  }),
  JSON.stringify({
    type: 'assistant',
    uuid: 'a2',
    timestamp: '2025-01-15T10:01:00Z',
    message: {
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'Found it.' }],
      usage: { input_tokens: 300, output_tokens: 80 },
      stop_reason: 'end_turn',
    },
  }),
].join('\n');
