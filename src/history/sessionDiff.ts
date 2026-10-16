import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { backupPath, FileBaseline } from './fileHistory';

export const HISTORY_SCHEME = 'claude-history';

// The JSONL line recording an edit lands just after the write itself, so a file
// a little newer than the session's last line is still that session's work.
const EDITED_SINCE_GRACE_MS = 5_000;

/**
 * Serves file-history backups read-only. URIs keep the original file path so
 * the diff editor picks the right language; an empty query is an empty file.
 */
export class FileHistoryContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly claudeDir: string) {}

  provideTextDocumentContent(uri: vscode.Uri): string {
    const query = new URLSearchParams(uri.query);
    const file = backupPath(this.claudeDir, query.get('session') ?? '', query.get('backup') ?? '');
    if (!file) { return ''; }
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch {
      return '';
    }
  }
}

function historyUri(filePath: string, backup?: { session: string; backup: string }): vscode.Uri {
  return vscode.Uri.file(filePath).with({
    scheme: HISTORY_SCHEME,
    query: backup ? new URLSearchParams(backup).toString() : '',
  });
}

/** Opens VS Code's diff editor on a file as it was before the session against the file now. */
export async function openSessionDiff(filePath: string, baseline: FileBaseline, sessionEndTime: number | null): Promise<void> {
  const left = baseline.kind === 'backup'
    ? historyUri(filePath, { session: baseline.sessionId, backup: baseline.backupName })
    : historyUri(filePath);

  let right: vscode.Uri;
  let now = 'now';
  try {
    const { mtimeMs } = fs.statSync(filePath);
    right = vscode.Uri.file(filePath);
    if (sessionEndTime !== null && mtimeMs > sessionEndTime + EDITED_SINCE_GRACE_MS) {
      now = 'now, edited since';
    }
  } catch {
    right = historyUri(filePath);
    now = 'deleted since';
  }

  const before = baseline.kind === 'created' ? 'new file' : 'before session';
  await vscode.commands.executeCommand(
    'vscode.diff',
    left,
    right,
    `${path.basename(filePath)} (${before} ↔ ${now})`,
    { preview: true },
  );
}
