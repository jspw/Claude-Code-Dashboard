import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Claude Code keeps per-session file backups in ~/.claude/file-history/<sessionId>/,
// named <hash>@v<n> where the hash is the first 16 hex chars of the SHA-256 of
// the file's absolute path. @v1 is the file as it stood just before the
// session's first edit; a file the session created gets no @v1.

const SESSION_ID = /^[A-Za-z0-9-]+$/;
const BACKUP_NAME = /^[0-9a-f]{16}@v\d+$/;

export type FileBaseline =
  | { kind: 'backup'; sessionId: string; backupName: string }
  | { kind: 'created' };

export function backupHash(filePath: string): string {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16);
}

/** A backup's location, or null when either part could reach outside file-history. */
export function backupPath(claudeDir: string, sessionId: string, backupName: string): string | null {
  if (!SESSION_ID.test(sessionId) || !BACKUP_NAME.test(backupName)) { return null; }
  return path.join(claudeDir, 'file-history', sessionId, backupName);
}

/**
 * What a session's edited file looked like before the session touched it.
 * Null when there is no record of it: the backups were cleaned up, or the
 * edit came from a subagent, whose edits Claude Code doesn't back up.
 */
export function findBaseline(claudeDir: string, sessionId: string, filePath: string, createdInSession: boolean): FileBaseline | null {
  const backupName = `${backupHash(filePath)}@v1`;
  const file = backupPath(claudeDir, sessionId, backupName);
  if (file && fs.existsSync(file)) { return { kind: 'backup', sessionId, backupName }; }
  // A Write over an existing file still leaves a @v1, so no @v1 here means it was new.
  return createdInSession ? { kind: 'created' } : null;
}
