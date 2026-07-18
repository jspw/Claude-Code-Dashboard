import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HookManager, LIVE_MARKER_FILE } from '../HookManager';
import { stripDashboardHooks } from '../stripDashboardHooks';

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
    expect(manager.needsReinjection({ get: () => 2 })).toBe(true);
    expect(manager.needsReinjection({ get: () => 3 })).toBe(false);
  });

  it('injects hooks, removes old dashboard hooks, arms the marker, and updates state', async () => {
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
    // settings.json + marker file
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    const written = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[0][1]));
    expect(written.hooks.PostToolUse).toHaveLength(2);
    expect(JSON.stringify(written.hooks.Stop)).toContain('.dashboard-events.jsonl');
    // injected command is guarded by the marker file
    expect(JSON.stringify(written.hooks.PostToolUse)).toContain('.dashboard-live');
    expect(vi.mocked(fs.writeFileSync).mock.calls[1][0]).toBe(`/claude/${LIVE_MARKER_FILE}`);
    expect(update).toHaveBeenCalledWith('dashboardHookVersion', 3);
  });

  it('creates fresh hook settings when the file is missing or invalid', async () => {
    const manager = new HookManager('/claude');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('bad file');
    });

    await manager.injectHooks();
    await manager.injectHooks();

    const settingsWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(c => c[0] === '/claude/settings.json');
    const firstWrite = JSON.parse(String(settingsWrites[0][1]));
    const secondWrite = JSON.parse(String(settingsWrites[1][1]));

    expect(firstWrite.hooks.PostToolUse).toHaveLength(1);
    expect(firstWrite.hooks.Stop).toHaveLength(1);
    expect(secondWrite.hooks.PostToolUse).toHaveLength(1);
  });

  it('removeHooks deletes the marker, strips dashboard hooks, and clears the stored version', async () => {
    const manager = new HookManager('/claude');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: 'keep', hooks: [{ command: 'echo keep' }] }, { matcher: '*', hooks: [{ command: 'appendFileSync .dashboard-events.jsonl' }] }],
        Stop: [{ hooks: [{ command: 'appendFileSync .dashboard-events.jsonl' }] }],
      },
      otherSetting: true,
    }));
    const update = vi.fn(() => Promise.resolve());

    await manager.removeHooks({ update });

    expect(fs.unlinkSync).toHaveBeenCalledWith(`/claude/${LIVE_MARKER_FILE}`);
    expect(fs.copyFileSync).toHaveBeenCalledWith('/claude/settings.json', '/claude/settings.json.bak');
    const written = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[0][1]));
    expect(written.hooks.PostToolUse).toHaveLength(1);
    expect(written.hooks.Stop).toBeUndefined();
    expect(written.otherSetting).toBe(true);
    expect(update).toHaveBeenCalledWith('dashboardHookVersion', undefined);
  });

  it('removeHooks leaves settings untouched when nothing was injected', async () => {
    const manager = new HookManager('/claude');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'keep', hooks: [{ command: 'echo keep' }] }] } }));

    await manager.removeHooks();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });
});

describe('stripDashboardHooks', () => {
  it('removes only dashboard entries and drops the hooks key when empty', () => {
    const settings: Record<string, unknown> = {
      hooks: {
        PostToolUse: [{ matcher: '*', hooks: [{ command: 'x .dashboard-events.jsonl' }] }],
        Stop: [{ hooks: [{ command: 'y .dashboard-events.jsonl' }] }],
      },
    };
    expect(stripDashboardHooks(settings)).toBe(true);
    expect(settings.hooks).toBeUndefined();
  });

  it('returns false when there is nothing to strip', () => {
    const settings: Record<string, unknown> = { hooks: { Stop: [{ hooks: [{ command: 'echo hi' }] }] } };
    expect(stripDashboardHooks(settings)).toBe(false);
    expect(settings.hooks).toBeDefined();

    expect(stripDashboardHooks({})).toBe(false);
  });
});
