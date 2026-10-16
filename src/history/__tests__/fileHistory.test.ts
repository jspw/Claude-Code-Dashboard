import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupHash, backupPath, findBaseline } from '../fileHistory';

const SESSION = '0f8c1d2e-3a4b-4c5d-8e6f-708192a3b4c5';
const FILE = '/repo/src/app.ts';

describe('fileHistory', () => {
  let claudeDir: string;

  beforeEach(() => {
    claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-history-'));
  });

  afterEach(() => {
    fs.rmSync(claudeDir, { recursive: true, force: true });
  });

  const writeBackup = (name: string, content = 'before') => {
    const dir = path.join(claudeDir, 'file-history', SESSION);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  };

  it('names backups the way Claude Code does', () => {
    expect(backupHash(FILE)).toBe('549b8c575be694c4');
  });

  it('refuses session IDs or backup names that could leave file-history', () => {
    expect(backupPath(claudeDir, SESSION, '549b8c575be694c4@v1'))
      .toBe(path.join(claudeDir, 'file-history', SESSION, '549b8c575be694c4@v1'));
    expect(backupPath(claudeDir, '../projects', '549b8c575be694c4@v1')).toBeNull();
    expect(backupPath(claudeDir, SESSION, '../../settings.json')).toBeNull();
    expect(backupPath(claudeDir, SESSION, '549b8c575be694c4@v1/..')).toBeNull();
  });

  it('uses the backup taken before the first edit', () => {
    writeBackup('549b8c575be694c4@v1');
    writeBackup('549b8c575be694c4@v2');

    expect(findBaseline(claudeDir, SESSION, FILE, false))
      .toEqual({ kind: 'backup', sessionId: SESSION, backupName: '549b8c575be694c4@v1' });
  });

  it('prefers the backup even when the parser saw the file as created', () => {
    writeBackup('549b8c575be694c4@v1');

    expect(findBaseline(claudeDir, SESSION, FILE, true)).toMatchObject({ kind: 'backup' });
  });

  it('starts a created file from nothing', () => {
    writeBackup('549b8c575be694c4@v2');

    expect(findBaseline(claudeDir, SESSION, FILE, true)).toEqual({ kind: 'created' });
  });

  it('has no baseline for an edited file whose history is gone', () => {
    expect(findBaseline(claudeDir, SESSION, FILE, false)).toBeNull();
  });
});
