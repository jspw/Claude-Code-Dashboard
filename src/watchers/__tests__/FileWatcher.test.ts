import * as fs from 'fs';
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
    vi.mocked(fs.watch).mockImplementation((_dir, _opts, cb: any) => {
      cb('change', 'proj/a.jsonl');
      cb('change', 'proj/a.jsonl');
      cb('change', 'proj/readme.md');
      return { close, on } as any;
    });

    const watcher = new FileWatcher('/claude', { onFileChanged } as any);
    const context = { subscriptions: [] as any[] };
    watcher.start(context as any);

    vi.advanceTimersByTime(299);
    expect(onFileChanged).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFileChanged).toHaveBeenCalledOnce();
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(context.subscriptions).toHaveLength(1);
  });
});
