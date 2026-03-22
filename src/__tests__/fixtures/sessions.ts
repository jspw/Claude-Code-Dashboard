import { Project, Session, Turn, ToolCall, LiveEvent } from '../../store/DashboardStore';

let _id = 0;
const uid = () => `test-${++_id}`;

export function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: uid(),
    name: 'Read',
    input: { file_path: '/src/index.ts' },
    ...overrides,
  };
}

export function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: uid(),
    role: 'user',
    content: 'Hello world',
    inputTokens: 100,
    outputTokens: 200,
    toolCalls: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    id: uid(),
    projectId: 'test-project',
    parentSessionId: null,
    cwd: '/home/user/project',
    isActiveSession: false,
    startTime: now - 3600_000,
    endTime: now,
    durationMs: 3600_000,
    inputTokens: 10000,
    cacheCreationTokens: 5000,
    cacheReadTokens: 50000,
    outputTokens: 3000,
    totalTokens: 18000,
    costUsd: 0.25,
    promptCount: 5,
    toolCallCount: 10,
    filesModified: ['/src/index.ts'],
    filesCreated: [],
    turns: [
      makeTurn({ role: 'user', content: 'Fix the bug in index.ts' }),
      makeTurn({ role: 'assistant', content: 'Done.', toolCalls: [makeToolCall()] }),
    ],
    sessionSummary: 'Fix the bug in index.ts',
    hasThinking: false,
    thinkingTokens: 0,
    cacheHitRate: 76.9,
    subagentCostUsd: 0,
    idleTimeMs: null,
    activeTimeMs: null,
    activityRatio: null,
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project',
    name: 'test-project',
    path: '/home/user/test-project',
    lastActive: Date.now(),
    isActive: false,
    sessionCount: 3,
    totalTokens: 50000,
    totalCostUsd: 1.5,
    techStack: ['Node.js', 'TypeScript'],
    ...overrides,
  };
}

export function makeLiveEvent(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    type: 'tool_use',
    tool: 'Read',
    timestamp: Date.now(),
    ...overrides,
  };
}
