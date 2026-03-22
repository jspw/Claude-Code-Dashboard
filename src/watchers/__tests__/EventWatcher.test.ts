import * as fs from 'fs';
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

    vi.stubGlobal('setInterval', vi.fn((cb) => {
      interval = cb as any;
      return 1 as any;
    }));
    vi.stubGlobal('clearInterval', vi.fn());

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync)
      .mockReturnValueOnce({ size: 6 * 1024 * 1024 } as any)
      .mockReturnValueOnce({ size: 30_000 } as any);
    vi.mocked(fs.readFileSync).mockReturnValue('{"type":"tool_use"}\n'.repeat(1200) as any);
    vi.mocked(fs.openSync).mockReturnValue(10 as any);
    vi.mocked(fs.readSync).mockImplementation((_fd, buffer) => {
      buffer.write('{"type":"tool_use","timestamp":1}\n');
      return buffer.length;
    });

    const watcher = new EventWatcher('/claude', { handleLiveEvent } as any);
    const context = { subscriptions: [] as any[] };
    watcher.start(context as any);
    interval?.();

    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    expect(handleLiveEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_use', timestamp: 1 }));
    expect(context.subscriptions).toHaveLength(1);
  });
});
