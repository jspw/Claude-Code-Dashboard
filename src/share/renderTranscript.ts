import type { Session, ToolCall, Turn } from '../store/DashboardStore';
import { promptText } from '../parsers/promptText';
import { toProjectRelative, truncate, yamlString } from './markdown';

const MAX_ARG_LENGTH = 120;

// Checked in order; the first present key becomes the displayed argument.
const PRIMARY_ARG_KEYS = ['file_path', 'command', 'pattern', 'path', 'query', 'skill'];

/**
 * Commands routinely embed absolute paths. The reader already has the repository,
 * and the absolute form only adds noise and a home directory to text that may be
 * handed to someone else. `<project>/src` becomes `src` and the bare project path
 * becomes `.` — but only where the path ends, since `<project>-two` is a sibling.
 */
function stripProjectPath(value: string, projectPath: string): string {
  if (!projectPath) { return value; }
  const escaped = projectPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value
    .split(`${projectPath}/`).join('')
    .replace(new RegExp(`${escaped}(?=$|[\\s'"\`;&|)])`, 'g'), '.');
}

/**
 * Picks the one argument worth showing for a tool call. Full input is omitted:
 * the receiving agent has the repository and can inspect current state itself.
 */
export function primaryArg(toolCall: ToolCall, projectPath: string): string {
  for (const key of PRIMARY_ARG_KEYS) {
    const value = toolCall.input?.[key];
    if (typeof value === 'string' && value.trim()) {
      const display = key === 'file_path' || key === 'path'
        ? toProjectRelative(value, projectPath)
        : stripProjectPath(value.replace(/\r?\n/g, ' '), projectPath);
      return truncate(display.trim(), MAX_ARG_LENGTH);
    }
  }
  return '';
}

function renderToolCall(toolCall: ToolCall, projectPath: string): string {
  const arg = primaryArg(toolCall, projectPath);
  return arg ? `\`${toolCall.name}\` ${arg}` : `\`${toolCall.name}\``;
}

/** Project-relative, deduped list of every file the session touched. */
export function sessionFiles(session: Session, projectPath: string): string[] {
  const seen = new Set<string>();
  for (const file of [...session.filesCreated, ...session.filesModified]) {
    seen.add(toProjectRelative(file, projectPath));
  }
  return [...seen];
}

export interface TurnLabels {
  user: string;
  assistant: string;
}

/**
 * Renders the conversation itself, under caller-chosen role labels — headings for
 * a standalone file, bold labels for text pasted into another agent's chat, where
 * a heading would compete with the surrounding conversation.
 *
 * Returns an empty array when no turn carries content, leaving the caller to say so.
 */
export function renderTurns(turns: Turn[], projectPath: string, labels: TurnLabels): string[] {
  const lines: string[] = [];
  let speaking: Turn['role'] | null = null;

  for (const turn of turns) {
    // Thinking is deliberately dropped: internal reasoning, and often most of the bytes.
    // Injected user messages are not the user speaking (see promptText).
    const raw = turn.content?.trim() ?? '';
    const content = turn.role === 'user' ? (turn.isMeta ? null : promptText(raw)) : raw;
    if (!content && turn.toolCalls.length === 0) { continue; }

    // One label per run of turns from the same speaker. A single reply arrives split
    // across prose and tool calls, and re-labelling every fragment reads as a stutter.
    if (turn.role !== speaking) {
      lines.push(turn.role === 'user' ? labels.user : labels.assistant, '');
      speaking = turn.role;
    }

    if (content) { lines.push(content, ''); }

    if (turn.toolCalls.length > 0) {
      for (const toolCall of turn.toolCalls) {
        // List markers matter: consecutive plain lines would collapse into one paragraph.
        lines.push(`- ${renderToolCall(toolCall, projectPath)}`);
      }
      lines.push('');
    }
  }

  return lines;
}

/**
 * Renders one session as a markdown transcript.
 *
 * Tool *output* is omitted entirely. It is the large majority of the raw volume
 * and the least useful part to another agent, which has the repository and can
 * read current state directly. What survives is intent — what was asked and why —
 * which is the part that cannot be reconstructed from the working tree.
 */
export function renderTranscript(session: Session, projectPath: string): string {
  const files = sessionFiles(session, projectPath);

  const lines: string[] = [
    '---',
    `session: ${session.id}`,
    `date: ${new Date(session.startTime).toISOString()}`,
  ];
  if (session.model) { lines.push(`model: ${session.model}`); }
  if (session.sessionSummary) { lines.push(`summary: ${yamlString(session.sessionSummary)}`); }
  if (files.length > 0) { lines.push(`files: ${yamlString(files.join(', '))}`); }
  lines.push('---', '');

  const body = renderTurns(session.turns, projectPath, { user: '## You', assistant: '## Claude' });
  lines.push(...(body.length > 0 ? body : ['_No conversation content recorded for this session._', '']));

  return `${lines.join('\n').trimEnd()}\n`;
}
