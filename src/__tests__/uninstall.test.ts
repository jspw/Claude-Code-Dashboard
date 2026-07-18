import * as fs from 'fs';
import * as os from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs');
vi.mock('os', () => ({ homedir: vi.fn() }));

describe('uninstall cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/test');
  });

  it('removes runtime files and strips only dashboard hooks from settings', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        PostToolUse: [
          { hooks: [{ command: 'append .dashboard-events.jsonl' }] },
          { hooks: [{ command: 'echo keep-me' }] },
        ],
        Stop: [{ hooks: [{ command: 'append .dashboard-events.jsonl' }] }],
      },
      theme: 'dark',
    }));

    await import('../uninstall');

    expect(fs.unlinkSync).toHaveBeenNthCalledWith(1, '/home/test/.claude/.dashboard-live');
    expect(fs.unlinkSync).toHaveBeenNthCalledWith(2, '/home/test/.claude/.dashboard-events.jsonl');
    expect(fs.readFileSync).toHaveBeenCalledWith('/home/test/.claude/settings.json', 'utf-8');
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(String(vi.mocked(fs.writeFileSync).mock.calls[0][1]));
    expect(written).toEqual({
      hooks: { PostToolUse: [{ hooks: [{ command: 'echo keep-me' }] }] },
      theme: 'dark',
    });
  });

  it('does not rewrite settings when no dashboard hooks exist', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: { Stop: [{ hooks: [{ command: 'echo keep-me' }] }] },
    }));

    await import('../uninstall');

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('tolerates missing runtime files and unreadable settings', async () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('missing');
    });
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('unreadable');
    });

    await expect(import('../uninstall')).resolves.toBeDefined();

    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
