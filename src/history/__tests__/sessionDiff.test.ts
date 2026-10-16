import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileHistoryContentProvider, HISTORY_SCHEME, openSessionDiff } from '../sessionDiff';

const SESSION = '0f8c1d2e-3a4b-4c5d-8e6f-708192a3b4c5';
const BACKUP = '549b8c575be694c4@v1';

type UriLike = { fsPath: string; scheme: string; query?: string };

describe('sessionDiff', () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-diff-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const historyUri = (query: string) => ({ query }) as vscode.Uri;
  const diffCall = () => vi.mocked(vscode.commands.executeCommand).mock.calls[0] as [string, UriLike, UriLike, string, unknown];

  describe('FileHistoryContentProvider', () => {
    it('serves a backup by session and name', () => {
      fs.mkdirSync(path.join(dir, 'file-history', SESSION), { recursive: true });
      fs.writeFileSync(path.join(dir, 'file-history', SESSION, BACKUP), 'const before = 1;\n');
      const provider = new FileHistoryContentProvider(dir);

      expect(provider.provideTextDocumentContent(historyUri(`session=${SESSION}&backup=${encodeURIComponent(BACKUP)}`)))
        .toBe('const before = 1;\n');
    });

    it('serves nothing for an empty side, a missing backup, or a path outside file-history', () => {
      const provider = new FileHistoryContentProvider(dir);

      expect(provider.provideTextDocumentContent(historyUri(''))).toBe('');
      expect(provider.provideTextDocumentContent(historyUri(`session=${SESSION}&backup=${encodeURIComponent(BACKUP)}`))).toBe('');
      expect(provider.provideTextDocumentContent(historyUri('session=..&backup=settings.json'))).toBe('');
    });
  });

  describe('openSessionDiff', () => {
    const backup = { kind: 'backup', sessionId: SESSION, backupName: BACKUP } as const;

    it('diffs the backup against the file on disk', async () => {
      const file = path.join(dir, 'app.ts');
      fs.writeFileSync(file, 'const after = 2;\n');

      await openSessionDiff(file, backup, Date.now());

      const [command, left, right, title] = diffCall();
      expect(command).toBe('vscode.diff');
      expect(left).toMatchObject({ fsPath: file, scheme: HISTORY_SCHEME });
      expect(new URLSearchParams(left.query)).toEqual(new URLSearchParams({ session: SESSION, backup: BACKUP }));
      expect(right).toMatchObject({ fsPath: file, scheme: 'file' });
      expect(title).toBe('app.ts (before session ↔ now)');
    });

    it('starts a created file from an empty side', async () => {
      const file = path.join(dir, 'new.ts');
      fs.writeFileSync(file, 'export {};\n');

      await openSessionDiff(file, { kind: 'created' }, Date.now());

      const [, left, , title] = diffCall();
      expect(left).toMatchObject({ scheme: HISTORY_SCHEME, query: '' });
      expect(title).toBe('new.ts (new file ↔ now)');
    });

    it('says when the file changed after the session ended', async () => {
      const file = path.join(dir, 'app.ts');
      fs.writeFileSync(file, 'later\n');

      await openSessionDiff(file, backup, Date.now() - 60_000);

      expect(diffCall()[3]).toBe('app.ts (before session ↔ now, edited since)');
    });

    it('shows a deleted file as emptied', async () => {
      const file = path.join(dir, 'gone.ts');

      await openSessionDiff(file, backup, null);

      const [, , right, title] = diffCall();
      expect(right).toMatchObject({ scheme: HISTORY_SCHEME, query: '' });
      expect(title).toBe('gone.ts (before session ↔ deleted since)');
    });
  });
});
