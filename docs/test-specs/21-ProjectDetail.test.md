# Spec 21: ProjectDetail Component Tests

## Test File
**Path**: `webview-ui/src/views/__tests__/ProjectDetail.test.tsx`

## Source Under Test
**Path**: `webview-ui/src/views/ProjectDetail.tsx`

## Imports

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectDetail from '../ProjectDetail';
import { Project, Session, ProjectConfig, ProjectStats } from '../../types';
```

## Mock Setup

### 1. Mock recharts

```tsx
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  CartesianGrid: () => null,
}));
```

### 2. Mock vscode bridge

```tsx
const mockPostMessage = vi.fn();
vi.mock('../../vscode', () => ({
  vscode: { postMessage: mockPostMessage },
}));
```

### 3. Mock child components that have complex rendering

```tsx
vi.mock('../../components/SessionDetail', () => ({
  default: ({ session }: any) => <div data-testid="session-detail">{session?.id}</div>,
}));

vi.mock('../../components/WeeklyStatsTab', () => ({
  default: ({ projectStats }: any) => <div data-testid="weekly-stats-tab">Weekly Stats</div>,
}));

vi.mock('../../components/ToolUsageBar', () => ({
  default: () => <div data-testid="tool-usage-bar" />,
}));

vi.mock('../../components/MarkdownView', () => ({
  MarkdownView: ({ content }: any) => <div data-testid="markdown-view">{content}</div>,
  CommandBlock: ({ command }: any) => <div data-testid="command-block">{command.name}</div>,
}));
```

### 4. Reset mocks

```tsx
beforeEach(() => {
  mockPostMessage.mockClear();
});
```

## Sample Data

```tsx
const sampleProject: Project = {
  id: 'proj-1',
  name: 'My Test Project',
  path: '/Users/dev/my-test-project',
  lastActive: Date.now(),
  isActive: true,
  sessionCount: 5,
  totalTokens: 50000,
  totalCostUsd: 2.5,
  techStack: ['TypeScript', 'React', 'Node.js'],
};

const sampleSession: Session = {
  id: 'sess-1',
  projectId: 'proj-1',
  parentSessionId: null,
  cwd: '/Users/dev/my-test-project',
  isActiveSession: false,
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
  durationMs: 3600000,
  inputTokens: 2000,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  outputTokens: 1000,
  totalTokens: 3000,
  costUsd: 0.15,
  promptCount: 8,
  toolCallCount: 12,
  filesModified: ['src/index.ts'],
  filesCreated: [],
  turns: [],
  sessionSummary: 'Fixed bug in parser',
  hasThinking: false,
  thinkingTokens: 0,
  cacheHitRate: 0.5,
  subagentCostUsd: 0,
  idleTimeMs: null,
  activeTimeMs: null,
  activityRatio: null,
};

const sampleConfig: ProjectConfig = {
  claudeMd: '# Project Rules\n\nUse TypeScript only.',
  mcpServers: {
    'my-server': {
      name: 'my-server',
      command: 'npx my-mcp-server',
      type: 'stdio',
      toolCallCount: 5,
    },
  },
  projectSettings: {},
  commands: [
    { name: 'deploy', content: 'Deploy the application' },
  ],
};

const sampleProjectStats: ProjectStats = {
  usageOverTime: [],
  toolUsage: [
    { tool: 'Read', count: 20, percentage: 50 },
    { tool: 'Edit', count: 20, percentage: 50 },
  ],
  promptPatterns: [],
  efficiency: {
    avgTokensPerPrompt: 500,
    avgToolCallsPerSession: 10,
    avgSessionDurationMin: 30,
    firstTurnResolutionRate: 0.3,
    avgActiveRatio: 0.7,
  },
  recentToolCalls: [],
  weeklyStats: {
    sessions: 5,
    tokens: 50000,
    costUsd: 2.5,
    dailyBreakdown: [],
  },
};
```

## Test Cases

### Test 1: shows "Project not found" when project is null
**Description**: When `project` is falsy, show a fallback message.

```tsx
it('shows "Project not found" when project is null', () => {
  render(<ProjectDetail project={null as any} sessions={[]} />);
  expect(screen.getByText('Project not found.')).toBeInTheDocument();
});
```

**Assertions**:
- "Project not found." text is in the document.

### Test 2: renders project name and path
**Description**: The project header should display the project name and path.

```tsx
it('renders project name and path', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} />);
  expect(screen.getByText('My Test Project')).toBeInTheDocument();
  expect(screen.getByText('/Users/dev/my-test-project')).toBeInTheDocument();
});
```

**Assertions**:
- Project name and path are displayed.

### Test 3: shows tech stack badges
**Description**: Each item in `project.techStack` should render as a badge.

```tsx
it('shows tech stack badges', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} />);
  expect(screen.getByText('TypeScript')).toBeInTheDocument();
  expect(screen.getByText('React')).toBeInTheDocument();
  expect(screen.getByText('Node.js')).toBeInTheDocument();
});
```

**Assertions**:
- All three tech stack items are visible.

### Test 4: renders tab navigation
**Description**: The component should render all tab buttons: Sessions, Weekly, CLAUDE.md, Commands, Tools, MCP Servers, Subagents, Files.

```tsx
it('renders tab navigation', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} />);
  expect(screen.getByText('Sessions')).toBeInTheDocument();
  expect(screen.getByText('Weekly')).toBeInTheDocument();
  expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
  expect(screen.getByText('Commands')).toBeInTheDocument();
  expect(screen.getByText('Tools')).toBeInTheDocument();
  expect(screen.getByText('MCP Servers')).toBeInTheDocument();
  expect(screen.getByText('Subagents')).toBeInTheDocument();
  expect(screen.getByText('Files')).toBeInTheDocument();
});
```

**Assertions**:
- All 8 tab labels are present.

### Test 5: renders session list
**Description**: On the Sessions tab (default), each session should appear as a button with its date and summary.

```tsx
it('renders session list', () => {
  render(<ProjectDetail project={sampleProject} sessions={[sampleSession]} />);
  // Session shows its date and summary
  expect(screen.getByText('Fixed bug in parser')).toBeInTheDocument();
});
```

**Assertions**:
- The session summary text is visible.

### Test 6: shows export buttons (JSON/CSV)
**Description**: Two export buttons should be rendered in the header.

```tsx
it('shows export buttons', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} />);
  const jsonBtn = screen.getByText('Export JSON');
  const csvBtn = screen.getByText('Export CSV');
  expect(jsonBtn).toBeInTheDocument();
  expect(csvBtn).toBeInTheDocument();

  fireEvent.click(jsonBtn);
  expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'json' });

  fireEvent.click(csvBtn);
  expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportSessions', format: 'csv' });
});
```

**Assertions**:
- "Export JSON" and "Export CSV" buttons exist.
- Clicking them sends the correct messages.

### Test 7: switches tabs
**Description**: Clicking a tab button should switch the visible content. For example, clicking "CLAUDE.md" when config is present should show the markdown content.

```tsx
it('switches tabs', () => {
  render(<ProjectDetail project={sampleProject} sessions={[sampleSession]} config={sampleConfig} />);

  // Default is Sessions tab — session summary should be visible
  expect(screen.getByText('Fixed bug in parser')).toBeInTheDocument();

  // Switch to CLAUDE.md tab
  fireEvent.click(screen.getByText('CLAUDE.md'));
  expect(screen.getByTestId('markdown-view')).toBeInTheDocument();
});
```

**Assertions**:
- Initially on Sessions tab, session content is visible.
- After clicking CLAUDE.md tab, the markdown view renders.

### Test 8: renders CLAUDE.md tab content
**Description**: When on the CLAUDE.md tab with config containing `claudeMd`, the markdown content should render. When `claudeMd` is null, a fallback message appears.

```tsx
it('renders CLAUDE.md tab content', () => {
  const { rerender } = render(
    <ProjectDetail project={sampleProject} sessions={[]} config={sampleConfig} />
  );
  fireEvent.click(screen.getByText('CLAUDE.md'));
  expect(screen.getByTestId('markdown-view')).toBeInTheDocument();
  expect(screen.getByText('# Project Rules')).toBeInTheDocument();

  // Rerender without claudeMd
  const noClaudeConfig = { ...sampleConfig, claudeMd: null };
  rerender(<ProjectDetail project={sampleProject} sessions={[]} config={noClaudeConfig} />);
  expect(screen.getByText(/No CLAUDE\.md found/)).toBeInTheDocument();
});
```

**Assertions**:
- With `claudeMd` set, the MarkdownView mock renders the content.
- With `claudeMd: null`, the fallback "No CLAUDE.md found" message appears.

### Test 9: renders MCP servers tab
**Description**: Clicking the "MCP Servers" tab should display configured servers with their details.

```tsx
it('renders MCP servers tab', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} config={sampleConfig} />);
  fireEvent.click(screen.getByText('MCP Servers'));
  expect(screen.getByText('my-server')).toBeInTheDocument();
  expect(screen.getByText('stdio')).toBeInTheDocument();
  expect(screen.getByText(/npx my-mcp-server/)).toBeInTheDocument();
});
```

**Assertions**:
- Server name "my-server" is displayed.
- Server type "stdio" badge is displayed.
- Server command is displayed.

### Test 10: shows weekly stats tab
**Description**: Clicking the "Weekly" tab should render the WeeklyStatsTab component.

```tsx
it('shows weekly stats tab', () => {
  render(<ProjectDetail project={sampleProject} sessions={[]} projectStats={sampleProjectStats} />);
  fireEvent.click(screen.getByText('Weekly'));
  expect(screen.getByTestId('weekly-stats-tab')).toBeInTheDocument();
  expect(screen.getByText('Weekly Stats')).toBeInTheDocument();
});
```

**Assertions**:
- The mocked WeeklyStatsTab component is rendered with the correct data-testid.

## Validation Criteria
- All 10 tests pass with `npx vitest run src/views/__tests__/ProjectDetail.test.tsx` from the `webview-ui/` directory.
- Tab switching tests verify that clicking tab buttons changes visible content.
- Child component mocks keep tests focused on ProjectDetail's own logic.
