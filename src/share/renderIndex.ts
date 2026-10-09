import type { TranscriptEntry } from './types';
import { escapeTableCell } from './markdown';

const MAX_FILES_LISTED = 5;

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatFiles(files: string[]): string {
  if (files.length === 0) { return '—'; }
  const shown = files.slice(0, MAX_FILES_LISTED).map(file => `\`${file}\``).join(', ');
  const remaining = files.length - MAX_FILES_LISTED;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

/**
 * Renders the session index. Filenames appear in the table so an agent can grep
 * for a path and jump straight to the sessions that touched it.
 */
export function renderIndex(entries: TranscriptEntry[]): string {
  const lines = [
    '# Session history',
    '',
    'Transcripts of prior Claude Code sessions on this project, newest first.',
    'Open only what you need — these are reference material, not required reading.',
    '',
    '| Date | Summary | Files touched | Transcript |',
    '|---|---|---|---|',
  ];

  for (const entry of entries) {
    const summary = entry.summary ? escapeTableCell(entry.summary) : '—';
    lines.push(
      `| ${formatDate(entry.startTime)} | ${summary} | ${escapeTableCell(formatFiles(entry.files))} | [open](sessions/${entry.fileName}) |`
    );
  }

  lines.push('');
  return `${lines.join('\n').trimEnd()}\n`;
}
