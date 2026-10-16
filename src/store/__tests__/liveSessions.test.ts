import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSessionReader, processStartTimes } from '../liveSessions';

vi.mock('child_process', () => ({ execFileSync: vi.fn() }));

const STARTED = 'Thu Oct 15 07:12:14 2026';

describe('LiveSessionReader', () => {
  let claudeDir: string;
  let alive: Set<number>;

  beforeEach(() => {
    vi.mocked(execFileSync).mockReset();
    claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-sessions-'));
    fs.mkdirSync(path.join(claudeDir, 'sessions'));
    alive = new Set();
    vi.spyOn(process, 'kill').mockImplementation(((pid: number) => {
      if (!alive.has(pid)) { throw new Error('ESRCH'); }
      return true;
    }) as typeof process.kill);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(claudeDir, { recursive: true, force: true });
  });

  const writeSession = (name: string, content: unknown) =>
    fs.writeFileSync(path.join(claudeDir, 'sessions', name), typeof content === 'string' ? content : JSON.stringify(content));
  const psPrints = (lines: string) => vi.mocked(execFileSync).mockReturnValue(lines as never);

  it('is unavailable without a sessions directory', () => {
    fs.rmSync(path.join(claudeDir, 'sessions'), { recursive: true });

    expect(new LiveSessionReader(claudeDir).read()).toEqual({ sessions: new Map(), available: false });
  });

  it("reports each running session's state, and leaves Claude Code's files alone", () => {
    alive = new Set([1, 2, 3, 4]);
    writeSession('1.json', { pid: 1, sessionId: 's-busy', status: 'busy' });
    writeSession('2.json', { pid: 2, sessionId: 's-waiting', status: 'waiting', waitingFor: 'permission prompt' });
    writeSession('3.json', { pid: 3, sessionId: 's-idle', status: 'idle' });
    writeSession('4.json', { pid: 4, sessionId: 's-older', status: 'thinking-hard' });
    writeSession('5.json', { pid: 5, sessionId: 's-dead', status: 'busy' });
    writeSession('6.json', '{half-written');
    writeSession('1.0f3a.key', 'not json');

    const { sessions, available } = new LiveSessionReader(claudeDir).read();

    expect(available).toBe(true);
    expect(Object.fromEntries(sessions)).toEqual({
      's-busy': { status: 'busy', waitingFor: null },
      's-waiting': { status: 'waiting', waitingFor: 'permission prompt' },
      's-idle': { status: 'idle', waitingFor: null },
      's-older': { status: null, waitingFor: null },
    });
    expect(fs.readdirSync(path.join(claudeDir, 'sessions'))).toHaveLength(7);
    expect(execFileSync).not.toHaveBeenCalled();   // no procStart, nothing to compare
  });

  it('drops a crash leftover whose PID now belongs to another process', () => {
    alive = new Set([10, 11]);
    writeSession('10.json', { pid: 10, sessionId: 'same', procStart: STARTED, status: 'idle' });
    writeSession('11.json', { pid: 11, sessionId: 'reused', procStart: STARTED, status: 'idle' });
    psPrints(`   10 Thu Oct 15 07:12:14 2026\n   11 Fri Oct 16 09:01:42 2026\n`);

    const { sessions } = new LiveSessionReader(claudeDir).read();

    expect([...sessions.keys()]).toEqual(['same']);
    expect(execFileSync).toHaveBeenCalledWith('ps', ['-o', 'pid=,lstart=', '-p', '10,11'],
      expect.objectContaining({ env: expect.objectContaining({ TZ: 'UTC', LC_ALL: 'C' }) }));
  });

  it('asks ps again only once its answer is 30 seconds old', () => {
    let now = 0;
    alive = new Set([10]);
    writeSession('10.json', { pid: 10, sessionId: 's', procStart: STARTED, status: 'busy' });
    psPrints(`10 ${STARTED}\n`);
    const reader = new LiveSessionReader(claudeDir, () => now);

    reader.read();
    now = 29_000;
    reader.read();
    expect(execFileSync).toHaveBeenCalledTimes(1);

    now = 31_000;
    reader.read();
    expect(execFileSync).toHaveBeenCalledTimes(2);
  });

  it('trusts a live PID when ps cannot be run', () => {
    alive = new Set([10]);
    writeSession('10.json', { pid: 10, sessionId: 's', procStart: STARTED, status: 'busy' });
    vi.mocked(execFileSync).mockImplementation(() => { throw Object.assign(new Error('spawn ps ENOENT'), { code: 'ENOENT' }); });

    expect([...new LiveSessionReader(claudeDir).read().sessions.keys()]).toEqual(['s']);
  });
});

describe('processStartTimes', () => {
  beforeEach(() => vi.mocked(execFileSync).mockReset());
  afterEach(() => vi.mocked(execFileSync).mockReset());

  it("keeps the PIDs ps still lists when others are gone, and pads days the way ps does", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw Object.assign(new Error('exit 1'), { status: 1, stdout: '  7 Fri Oct  2 09:01:42 2026\n' });
    });

    expect(processStartTimes([7, 8])).toEqual(new Map([[7, 'Fri Oct  2 09:01:42 2026']]));
  });

  it('gives up on any other failure', () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', status: null }); });

    expect(processStartTimes([7])).toBeNull();
  });
});
