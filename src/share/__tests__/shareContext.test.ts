import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareContext } from '../shareContext';
import { renderAgentsMd } from '../renderAgentsMd';
import type { DashboardStore } from '../../store/DashboardStore';
import { makeProject, makeProjectConfig, makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

const fs = vscode.workspace.fs as unknown as {
  writeFile: ReturnType<typeof vi.fn>;
  createDirectory: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
};
const encode = (text: string) => new TextEncoder().encode(text);
const window = vscode.window as unknown as Record<string, ReturnType<typeof vi.fn>>;
const commands = vscode.commands as unknown as Record<string, ReturnType<typeof vi.fn>>;
const clipboard = vscode.env.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> };

const project = makeProject({ id: 'p1', name: 'Alpha', path: '/home/user/alpha' });
const sessionA = makeSession({ id: 's1', sessionSummary: 'First' });
const sessionB = makeSession({ id: 's2', sessionSummary: 'Second' });

function makeStore(overrides: Partial<Record<string, unknown>> = {}): DashboardStore {
  return {
    getProject: vi.fn(() => project),
    getSessions: vi.fn(() => [sessionA, sessionB]),
    getProjectConfig: vi.fn(() => makeProjectConfig()),
    ...overrides,
  } as unknown as DashboardStore;
}

const writtenPaths = () => fs.writeFile.mock.calls.map(call => call[0].fsPath as string);

beforeEach(() => {
  vi.clearAllMocks();
  fs.writeFile.mockResolvedValue(undefined);
  fs.createDirectory.mockResolvedValue(undefined);
  fs.readFile.mockRejectedValue(new Error('ENOENT'));
  window.withProgress.mockImplementation((_o: unknown, task: () => Promise<unknown>) => task());
  window.showInformationMessage.mockResolvedValue(undefined);
  window.showWarningMessage.mockResolvedValue(undefined);
  clipboard.writeText.mockResolvedValue(undefined);
  vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
});

describe('shareContext', () => {
  it('does nothing when the project is unknown', async () => {
    await shareContext(makeStore({ getProject: vi.fn(() => undefined) }), 'nope', 'project');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('writes AGENTS.md, an index, and a transcript per session for project scope', async () => {
    await shareContext(makeStore(), 'p1', 'project');
    const paths = writtenPaths();

    expect(paths).toContain('/home/user/alpha/AGENTS.md');
    expect(paths).toContain('/home/user/alpha/.agent-context/INDEX.md');
    expect(paths.filter(p => p.includes('/.agent-context/sessions/'))).toHaveLength(2);
  });

  it('copies the selected session to the clipboard and writes no files at all', async () => {
    await shareContext(makeStore(), 'p1', 'session', 's2');

    expect(fs.writeFile).not.toHaveBeenCalled();
    const copied = clipboard.writeText.mock.calls[0][0] as string;
    expect(copied).toContain('# Earlier session on Alpha');
    expect(copied).toContain('**Topic:** Second');
    expect(copied).toContain('**Me:**');
    // Project configuration belongs to the other scope; the agent already has it.
    expect(copied).not.toContain('Use tabs, not spaces.');
  });

  it('reports the pasteable size and offers an untitled copy', async () => {
    window.showInformationMessage.mockResolvedValue('Open a copy');
    await shareContext(makeStore(), 'p1', 'session', 's1');

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('copied to clipboard (~'),
      'Open a copy'
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'markdown' })
    );
    expect(window.showTextDocument).toHaveBeenCalled();
  });

  it('warns instead when the session is too long to paste in one message', async () => {
    const huge = makeSession({
      id: 's3',
      turns: [makeTurn({ role: 'user', content: 'x'.repeat(120_000) })],
    });
    await shareContext(makeStore({ getSessions: vi.fn(() => [huge]) }), 'p1', 'session', 's3');

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('some chats will reject it'),
      'Open a copy'
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('warns and copies nothing when the requested session is gone', async () => {
    await shareContext(makeStore(), 'p1', 'session', 'missing');
    expect(window.showWarningMessage).toHaveBeenCalledWith('That session is no longer available.');
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('asks before overwriting a hand-written AGENTS.md', async () => {
    fs.readFile.mockResolvedValue(encode('# Alpha\n\nHand-written agent notes.'));
    window.showWarningMessage.mockResolvedValue('Overwrite');

    await shareContext(makeStore(), 'p1', 'project');

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('AGENTS.md already exists'),
      expect.objectContaining({ modal: true }),
      'Overwrite'
    );
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('aborts entirely when the overwrite prompt is dismissed', async () => {
    fs.readFile.mockResolvedValue(encode('# Alpha\n\nHand-written agent notes.'));
    window.showWarningMessage.mockResolvedValue(undefined);

    await shareContext(makeStore(), 'p1', 'project');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('regenerates an AGENTS.md it generated earlier without asking', async () => {
    fs.readFile.mockResolvedValue(encode(renderAgentsMd(project, makeProjectConfig(), 2)));

    await shareContext(makeStore(), 'p1', 'project');

    expect(window.showWarningMessage).not.toHaveBeenCalled();
    expect(writtenPaths()).toContain('/home/user/alpha/AGENTS.md');
  });

  it('reports failures without suppressing the success message', async () => {
    fs.writeFile.mockRejectedValueOnce(new Error('EACCES'));
    await shareContext(makeStore(), 'p1', 'project');

    expect(window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('could not be written'));
    expect(window.showInformationMessage).toHaveBeenCalled();
  });

  it('stays silent when nothing at all could be written', async () => {
    fs.writeFile.mockRejectedValue(new Error('EACCES'));
    await shareContext(makeStore(), 'p1', 'project');
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('opens AGENTS.md when the user picks that action', async () => {
    window.showInformationMessage.mockResolvedValue('Open AGENTS.md');
    await shareContext(makeStore(), 'p1', 'project');
    expect(window.showTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/home/user/alpha/AGENTS.md' }),
      { preview: true }
    );
  });

  it('reveals the file when the user picks Reveal', async () => {
    window.showInformationMessage.mockResolvedValue('Reveal');
    await shareContext(makeStore(), 'p1', 'project');
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'revealFileInOS',
      expect.objectContaining({ fsPath: '/home/user/alpha/AGENTS.md' })
    );
  });

  it('keeps the home directory out of everything it shares', async () => {
    const session = makeSession({
      id: 's4',
      turns: [
        makeTurn({ role: 'user', content: 'Check /home/user/secrets/plan.md' }),
        makeTurn({ role: 'assistant', content: 'Reading.', toolCalls: [makeToolCall({ name: 'Read', input: { file_path: '/home/user/.claude/notes.md' } })] }),
      ],
    });
    const store = makeStore({
      getSessions: vi.fn(() => [session]),
      getProjectConfig: vi.fn(() => makeProjectConfig({ claudeMd: '# Alpha\n\nNotes live in /home/user/notes.' })),
    });

    await shareContext(store, 'p1', 'session', 's4', '/home/user');
    const copied = clipboard.writeText.mock.calls[0][0] as string;
    expect(copied).toContain('~/secrets/plan.md');
    expect(copied).toContain('`Read` ~/.claude/notes.md');
    expect(copied).not.toContain('/home/user');

    await shareContext(store, 'p1', 'project', undefined, '/home/user');
    const written = fs.writeFile.mock.calls.map(call => new TextDecoder().decode(call[1] as Uint8Array)).join('\n');
    expect(written).toContain('Notes live in ~/notes.');
    expect(written).not.toContain('/home/user');
  });

  it('runs generation inside a progress notification', async () => {
    await shareContext(makeStore(), 'p1', 'project');
    expect(window.withProgress).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Alpha') }),
      expect.any(Function)
    );
  });
});
