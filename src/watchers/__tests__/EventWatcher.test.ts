import * as fs from 'fs';
import type * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventWatcher } from '../EventWatcher';

vi.mock('fs');

describe('EventWatcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  it('rotates oversized event files and polls for new events', () => {
    const handleLiveEvent = vi.fn();
    let interval: (() => void) | undefined;

    vi.stubGlobal('setInterval', vi.fn((cb: Parameters<typeof setInterval>[0]) => {
      if (typeof cb === 'function') {
        interval = cb;
      }
      return 1;
    }));
    vi.stubGlobal('clearInterval', vi.fn());

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync)
      .mockReturnValueOnce({ size: 6 * 1024 * 1024 } as unknown as fs.Stats)
      .mockReturnValueOnce({ size: 30_000 } as unknown as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('{"type":"tool_use"}\n'.repeat(1200));
    vi.mocked(fs.openSync).mockReturnValue(10);
    vi.mocked(fs.readSync).mockImplementation((_fd, buffer) => {
      const target = buffer as Buffer;
      target.write('{"type":"tool_use","timestamp":1}\n');
      return target.length;
    });

    const watcher = new EventWatcher('/claude', { handleLiveEvent } as unknown as ConstructorParameters<typeof EventWatcher>[1]);
    const context = { subscriptions: [] as vscode.Disposable[] };
    watcher.start(context as unknown as vscode.ExtensionContext);
    interval?.();

    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    expect(handleLiveEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_use', timestamp: 1 }));
    expect(context.subscriptions).toHaveLength(1);
  });

  it('skips rotation and event handling when files are missing, unchanged, or malformed', () => {
    const handleLiveEvent = vi.fn();
    let interval: (() => void) | undefined;

    vi.stubGlobal('setInterval', vi.fn((cb: Parameters<typeof setInterval>[0]) => {
      if (typeof cb === 'function') {
        interval = cb;
      }
      return 1;
    }));
    vi.stubGlobal('clearInterval', vi.fn());

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as unknown as fs.Stats);

    const watcher = new EventWatcher('/claude', { handleLiveEvent } as unknown as ConstructorParameters<typeof EventWatcher>[1]);
    watcher.start({ subscriptions: [] } as unknown as vscode.ExtensionContext);
    interval?.();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(handleLiveEvent).not.toHaveBeenCalled();
  });

  it('covers direct guard paths for rotation and polling', () => {
    const watcher = new EventWatcher('/claude', { handleLiveEvent: vi.fn() } as unknown as ConstructorParameters<typeof EventWatcher>[1]);

    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true);
    vi.mocked(fs.statSync)
      .mockReturnValueOnce({ size: 1024 } as unknown as fs.Stats)
      .mockReturnValueOnce({ size: 0 } as unknown as fs.Stats);

    (watcher as unknown as { rotateEventsFile(): void }).rotateEventsFile();
    (watcher as unknown as { checkForNewEvents(): void }).checkForNewEvents();

    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.openSync).not.toHaveBeenCalled();
  });
});
