import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HookManager } from '../HookManager';

vi.mock('fs');

type HookState = {
  get(key: string): unknown;
  update(key: string, value: unknown): Promise<void>;
};

describe('HookManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('detects reinjection by version', () => {
    const manager = new HookManager('/claude');
    expect(manager.needsReinjection({ get: () => 1 })).toBe(true);
    expect(manager.needsReinjection({ get: () => 2 })).toBe(false);
  });

  it('injects hooks, removes old dashboard hooks, and updates state', async () => {
    const manager = new HookManager('/claude');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        PostToolUse: [{ hooks: [{ command: 'old .dashboard-events.jsonl hook' }] }, { matcher: 'keep', hooks: [{ command: 'echo keep' }] }],
        Stop: [{ hooks: [{ command: 'old .dashboard-events.jsonl stop' }] }],
      },
    }));
    const update = vi.fn(() => Promise.resolve());
    const state: HookState = { get: vi.fn(), update };

    await manager.injectHooks(state);

    expect(fs.copyFileSync).toHaveBeenCalledWith('/claude/settings.json', '/claude/settings.json.bak');
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[0][1]));
    expect(written.hooks.PostToolUse).toHaveLength(2);
    expect(JSON.stringify(written.hooks.Stop)).toContain('.dashboard-events.jsonl');
    expect(update).toHaveBeenCalledWith('dashboardHookVersion', 2);
  });

  it('creates fresh hook settings when the file is missing or invalid', async () => {
    const manager = new HookManager('/claude');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('bad file');
    });

    await manager.injectHooks();
    await manager.injectHooks();

    const firstWrite = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[0][1]));
    const secondWrite = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[1][1]));

    expect(firstWrite.hooks.PostToolUse).toHaveLength(1);
    expect(firstWrite.hooks.Stop).toHaveLength(1);
    expect(secondWrite.hooks.PostToolUse).toHaveLength(1);
  });
});
