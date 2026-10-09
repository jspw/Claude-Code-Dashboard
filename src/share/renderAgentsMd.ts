import type { Project, ProjectConfig, MemoryFile } from '../store/DashboardStore';
import { GENERATED_MARKER, INDEX_FILE } from './types';
import { commandDescription, escapeTableCell, stripWikiLinks } from './markdown';

// Memory types in the order they should appear; anything else sorts last.
const TYPE_ORDER = ['user', 'feedback', 'project', 'reference'];

const TYPE_HEADINGS: Record<string, string> = {
  user: 'About the user',
  feedback: 'Feedback and working agreements',
  project: 'Project context',
  reference: 'References',
};

function headingFor(type: string): string {
  return TYPE_HEADINGS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

function groupByType(files: MemoryFile[]): [string, MemoryFile[]][] {
  const groups = new Map<string, MemoryFile[]>();
  for (const file of files) {
    const type = file.type || 'unknown';
    const existing = groups.get(type);
    if (existing) { existing.push(file); } else { groups.set(type, [file]); }
  }

  return [...groups.entries()].sort(([a], [b]) => {
    const ai = TYPE_ORDER.indexOf(a);
    const bi = TYPE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) { return a.localeCompare(b); }
    if (ai === -1) { return 1; }
    if (bi === -1) { return -1; }
    return ai - bi;
  });
}

function renderMemory(files: MemoryFile[]): string[] {
  if (files.length === 0) { return []; }

  const lines = ['## Working knowledge', '', 'Facts recorded during prior sessions.', ''];
  for (const [type, group] of groupByType(files)) {
    lines.push(`### ${headingFor(type)}`, '');
    for (const file of group) {
      const description = file.description ? ` — ${stripWikiLinks(file.description)}` : '';
      lines.push(`- **${file.name}**${description}`);
      const body = stripWikiLinks(file.content).trim();
      if (body) {
        for (const line of body.split('\n')) {
          lines.push(line ? `  ${line}` : '');
        }
      }
      lines.push('');
    }
  }
  return lines;
}

function renderPlans(config: ProjectConfig): string[] {
  if (config.plans.length === 0) { return []; }
  const lines = ['## Plans', ''];
  for (const plan of config.plans) {
    const description = plan.description ? ` — ${plan.description}` : '';
    lines.push(`- **${plan.name}**${description}`);
  }
  lines.push('');
  return lines;
}

function renderCommands(config: ProjectConfig): string[] {
  if (config.commands.length === 0) { return []; }
  const lines = ['## Custom commands', '', 'Workflows defined for this project.', ''];
  for (const command of config.commands) {
    const description = commandDescription(command.content);
    lines.push(`- \`/${command.name}\`${description ? ` — ${description}` : ''}`);
  }
  lines.push('');
  return lines;
}

function renderMcp(config: ProjectConfig): string[] {
  const servers = Object.values(config.mcpServers);
  if (servers.length === 0) { return []; }

  const lines = ['## MCP servers', '', '| Server | Transport |', '|---|---|'];
  for (const server of servers) {
    lines.push(`| ${escapeTableCell(server.name)} | ${escapeTableCell(server.type ?? 'stdio')} |`);
  }
  lines.push('');
  return lines;
}

function renderHooks(config: ProjectConfig): string[] {
  if (config.hooks.length === 0) { return []; }

  const lines = ['## Automation', '', '| Event | Matcher | Command |', '|---|---|---|'];
  for (const hook of config.hooks) {
    lines.push(
      `| ${escapeTableCell(hook.event)} | ${escapeTableCell(hook.matcher ?? '*')} | \`${escapeTableCell(hook.command)}\` |`
    );
  }
  lines.push('');
  return lines;
}

function renderHistory(sessionCount: number): string[] {
  if (sessionCount === 0) { return []; }

  return [
    '## Prior session history',
    '',
    `${sessionCount} session${sessionCount === 1 ? '' : 's'} indexed at \`${INDEX_FILE}\`.`,
    'Open the relevant file when you need background on a specific area — don\'t read them all.',
    '',
  ];
}

/**
 * Renders AGENTS.md from a project's existing configuration and memory.
 *
 * Nothing here is synthesized: CLAUDE.md is copied verbatim and memory files are
 * re-rendered from the name/description/type frontmatter Claude already wrote.
 * Sections are omitted entirely when their source data is empty.
 */
export function renderAgentsMd(
  project: Project,
  config: ProjectConfig,
  sessionCount: number,
  generatedAt: Date = new Date()
): string {
  const lines: string[] = [
    `# ${project.name}`,
    '',
    `${GENERATED_MARKER} · ${generatedAt.toISOString()} · regenerate to refresh -->`,
    '',
  ];

  // CLAUDE.md keeps its own heading levels and is not wrapped in a section of
  // ours: its `#`/`##` headings would outrank or sit beside the wrapper instead
  // of nesting under it, and demoting them risks rewriting fenced code blocks.
  // A blockquote attributes the block, and a rule closes it before our sections.
  if (config.claudeMd) {
    lines.push('> Project instructions, copied verbatim from `CLAUDE.md`.', '', config.claudeMd.trim(), '', '---', '');
  }

  lines.push(
    ...renderMemory(config.memory.files),
    ...renderPlans(config),
    ...renderCommands(config),
    ...renderMcp(config),
    ...renderHooks(config),
    ...renderHistory(sessionCount),
  );

  // No blank-line normalization here: CLAUDE.md is copied verbatim and may
  // contain fenced code blocks whose spacing is significant.
  return `${lines.join('\n').trimEnd()}\n`;
}
