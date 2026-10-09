import type { Project, Session } from '../store/DashboardStore';
import { truncate } from './markdown';
import { renderTurns, sessionFiles } from './renderTranscript';

const MAX_FILES_LISTED = 12;
const MAX_TOPIC_LENGTH = 120;

/**
 * Rough token count for the "will this fit in one message?" hint. Four characters
 * per token is the usual English approximation; it only needs to be right enough
 * to tell a short session from one that will not paste in one go.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) { return 'under a minute'; }
  if (minutes < 60) { return `${minutes}m`; }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function fileList(files: string[]): string {
  const shown = files.slice(0, MAX_FILES_LISTED).map(file => `\`${file}\``).join(', ');
  const rest = files.length - MAX_FILES_LISTED;
  return rest > 0 ? `${shown}, and ${rest} more` : shown;
}

/**
 * Renders one session as text meant to be pasted straight into another agent's chat.
 *
 * Nothing is written to disk and no project configuration is included: the receiving
 * agent is already working on this repository, so all that is missing is the
 * conversation. The preamble is addressed to that agent — it has to arrive knowing
 * what this text is, that tool results were dropped, and that the tree has moved on.
 */
export function renderHandoff(project: Project, session: Session): string {
  const files = sessionFiles(session, project.path);
  const started = new Date(session.startTime);

  const lines: string[] = [
    `# Earlier session on ${project.name}`,
    '',
    'Below is a conversation I had with another AI coding assistant (Claude Code) on this',
    'same project. I am sharing it so you have the background: what I asked for, what was',
    'tried, and why.',
    '',
    'Two things to keep in mind. Tool results are not included, only the calls — so read the',
    'files yourself rather than trusting anything here about their contents. And the code may',
    'have changed since, so treat all of this as history, not as the current state.',
    '',
  ];

  const day = started.toISOString().slice(0, 10);
  const meta: string[] = [
    session.durationMs ? `- **When:** ${day} · ${formatDuration(session.durationMs)}` : `- **When:** ${day}`,
  ];
  // Summaries are often the opening prompt verbatim, code fences and all; flattened
  // so a multi-line one cannot break out of the metadata list.
  const topic = truncate(session.sessionSummary?.replace(/\s+/g, ' ').trim() ?? '', MAX_TOPIC_LENGTH);
  if (topic) { meta.push(`- **Topic:** ${topic}`); }
  if (files.length > 0) { meta.push(`- **Files touched:** ${fileList(files)}`); }
  lines.push(...meta, '', '---', '');

  const body = renderTurns(session.turns, project.path, { user: '**Me:**', assistant: '**Claude:**' });
  lines.push(...(body.length > 0 ? body : ['_This session has no recorded conversation._', '']));

  return `${lines.join('\n').trimEnd()}\n`;
}
