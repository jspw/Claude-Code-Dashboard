import * as fs from 'fs';
import type * as vscode from 'vscode';
import { window } from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileWatcher } from '../FileWatcher';

vi.mock('fs');

describe('FileWatcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  it('starts fs.watch and debounces jsonl changes', () => {
    const onFileChanged = vi.fn();
    const close = vi.fn();
    const on = vi.fn();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.watch).mockImplementation((...args: unknown[]) => {
      const cb = args[2];
      if (typeof cb !== 'function') {
        throw new Error('watch listener missing');
      }
      cb?.('change', 'proj/a.jsonl');
      cb?.('change', 'proj/a.jsonl');
      cb?.('change', 'proj/readme.md');
      return { close, on } as unknown as fs.FSWatcher;
    });

    const watcher = new FileWatcher('/claude', { onFileChanged } as unknown as ConstructorParameters<typeof FileWatcher>[1]);
    const context = { subscriptions: [] as vscode.Disposable[] };
    watcher.start(context as unknown as vscode.ExtensionContext);

    vi.advanceTimersByTime(299);
    expect(onFileChanged).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFileChanged).toHaveBeenCalledOnce();
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(context.subscriptions).toHaveLength(1);
  });

  it('handles missing directories, watcher startup errors, and disposal', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFileChanged = vi.fn();
    const close = vi.fn();
    const context = { subscriptions: [] as vscode.Disposable[] };

    vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
    vi.mocked(fs.watch)
      .mockImplementationOnce(() => {
        throw new Error('watch failed');
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args[2];
        if (typeof cb === 'function') {
          cb('change', 'proj/a.jsonl');
        }
        return { close, on: vi.fn() } as unknown as fs.FSWatcher;
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args[2];
        if (typeof cb === 'function') {
          cb('change', 'proj/a.jsonl');
        }
        return { close, on: vi.fn() } as unknown as fs.FSWatcher;
      });

    new FileWatcher('/claude', { onFileChanged } as unknown as ConstructorParameters<typeof FileWatcher>[1])
      .start(context as unknown as vscode.ExtensionContext);
    new FileWatcher('/claude', { onFileChanged } as unknown as ConstructorParameters<typeof FileWatcher>[1])
      .start(context as unknown as vscode.ExtensionContext);
    new FileWatcher('/claude', { onFileChanged } as unknown as ConstructorParameters<typeof FileWatcher>[1])
      .start(context as unknown as vscode.ExtensionContext);

    context.subscriptions[0]?.dispose();
    context.subscriptions[1]?.dispose();
    context.subscriptions[2]?.dispose();

    expect(errorSpy).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it('holds changes back while the window is unfocused and applies them on focus (#34)', () => {
    const onFileChanged = vi.fn();
    let fire: ((event: string, name: string) => void) | undefined;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.watch).mockImplementation(((...args: unknown[]) => {
      fire = args[2] as typeof fire;
      return { close: vi.fn(), on: vi.fn() } as unknown as fs.FSWatcher;
    }) as typeof fs.watch);
    let onWindowState: ((state: { focused: boolean }) => void) | undefined;
    vi.mocked(window.onDidChangeWindowState).mockImplementation(listener => {
      onWindowState = listener as typeof onWindowState;
      return { dispose: vi.fn() };
    });
    const state = window.state as { focused: boolean };
    state.focused = false;

    new FileWatcher('/claude', { onFileChanged } as unknown as ConstructorParameters<typeof FileWatcher>[1])
      .start({ subscriptions: [] } as unknown as vscode.ExtensionContext);
    fire!('change', 'proj/a.jsonl');
    fire!('change', 'proj/b.jsonl');
    fire!('change', 'proj/a.jsonl');
    vi.advanceTimersByTime(300);
    expect(onFileChanged).not.toHaveBeenCalled();

    state.focused = true;
    onWindowState!({ focused: true });
    expect(onFileChanged.mock.calls.map(([file]) => file).sort()).toEqual(['/claude/projects/proj/a.jsonl', '/claude/projects/proj/b.jsonl']);

    onWindowState!({ focused: true });
    fire!('change', 'proj/c.jsonl');
    vi.advanceTimersByTime(300);
    expect(onFileChanged).toHaveBeenCalledTimes(3);
  });
});
