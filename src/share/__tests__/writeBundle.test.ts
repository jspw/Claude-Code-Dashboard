import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, writeBundle } from '../writeBundle';

const fs = vscode.workspace.fs as unknown as {
  writeFile: ReturnType<typeof vi.fn>;
  createDirectory: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
};

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

beforeEach(() => {
  vi.clearAllMocks();
  fs.writeFile.mockResolvedValue(undefined);
  fs.createDirectory.mockResolvedValue(undefined);
  fs.readFile.mockRejectedValue(new Error('ENOENT'));
});

describe('readTextFile', () => {
  it('decodes the file as UTF-8', async () => {
    fs.readFile.mockResolvedValue(new TextEncoder().encode('# Notes — ok'));
    await expect(readTextFile('/p/AGENTS.md')).resolves.toBe('# Notes — ok');
  });

  it('is null when the file cannot be read', async () => {
    await expect(readTextFile('/p/AGENTS.md')).resolves.toBeNull();
  });
});

describe('writeBundle', () => {
  it('joins relative paths onto the project root', async () => {
    await writeBundle([{ relativePath: 'AGENTS.md', content: 'hi' }], '/p');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile.mock.calls[0][0].fsPath).toBe('/p/AGENTS.md');
  });

  it('encodes content as UTF-8', async () => {
    await writeBundle([{ relativePath: 'AGENTS.md', content: '# héllo' }], '/p');
    expect(decode(fs.writeFile.mock.calls[0][1])).toBe('# héllo');
  });

  it('creates each parent directory once', async () => {
    await writeBundle([
      { relativePath: 'AGENTS.md', content: 'a' },
      { relativePath: '.agent-context/sessions/one.md', content: 'b' },
      { relativePath: '.agent-context/sessions/two.md', content: 'c' },
    ], '/p');

    const dirs = fs.createDirectory.mock.calls.map(call => call[0].fsPath);
    expect(dirs).toEqual(['/p', '/p/.agent-context/sessions']);
  });

  it('returns every written path', async () => {
    const result = await writeBundle([
      { relativePath: 'AGENTS.md', content: 'a' },
      { relativePath: '.agent-context/INDEX.md', content: 'b' },
    ], '/p');

    expect(result.written).toEqual(['/p/AGENTS.md', '/p/.agent-context/INDEX.md']);
    expect(result.failed).toEqual([]);
  });

  it('collects per-file failures instead of aborting the batch', async () => {
    fs.writeFile
      .mockRejectedValueOnce(new Error('EACCES'))
      .mockResolvedValueOnce(undefined);

    const result = await writeBundle([
      { relativePath: 'AGENTS.md', content: 'a' },
      { relativePath: '.agent-context/INDEX.md', content: 'b' },
    ], '/p');

    expect(result.failed).toEqual([{ path: '/p/AGENTS.md', message: 'EACCES' }]);
    expect(result.written).toEqual(['/p/.agent-context/INDEX.md']);
  });

  it('stringifies non-Error failures', async () => {
    fs.writeFile.mockRejectedValueOnce('disk full');
    const result = await writeBundle([{ relativePath: 'AGENTS.md', content: 'a' }], '/p');
    expect(result.failed[0].message).toBe('disk full');
  });

  it('records a failure when the directory cannot be created', async () => {
    fs.createDirectory.mockRejectedValueOnce(new Error('EROFS'));
    const result = await writeBundle([{ relativePath: 'AGENTS.md', content: 'a' }], '/p');
    expect(result.written).toEqual([]);
    expect(result.failed[0].message).toBe('EROFS');
  });
});
