import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Each running Claude Code process writes ~/.claude/sessions/<pid>.json and
// removes it on exit; a crash leaves one behind until Claude Code's next launch
// clears it. Claude Code owns these files, so they are only ever read here.

export type LiveStatus = 'busy' | 'waiting' | 'idle';

export interface LiveSession {
  status: LiveStatus | null;   // null: the file predates status reporting, or holds a value we don't know
  waitingFor: string | null;   // what a waiting session needs, e.g. "permission prompt"
}

export interface LiveSessions {
  sessions: Map<string, LiveSession>;   // sessionId → state
  available: boolean;                   // false when there is no sessions/ directory to read
}

interface SessionFile {
  pid?: unknown;
  sessionId?: unknown;
  procStart?: unknown;
  status?: unknown;
  waitingFor?: unknown;
}

interface RunningSession {
  pid: number;
  sessionId: string;
  procStart: string | null;
  meta: SessionFile;
}

// How long a PID's identity check stands before `ps` is asked again. A PID can
// only be reused after its process dies, and an exiting session removes its file,
// so this only matters for crash leftovers.
const IDENTITY_TTL_MS = 30_000;

const STATUSES: readonly LiveStatus[] = ['busy', 'waiting', 'idle'];

export class LiveSessionReader {
  private identity = new Map<string, { same: boolean; checkedAt: number }>();

  constructor(private readonly claudeDir: string, private readonly now: () => number = Date.now) {}

  read(): LiveSessions {
    const dir = path.join(this.claudeDir, 'sessions');
    let names: string[];
    try {
      names = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
    } catch {
      return { sessions: new Map(), available: false };
    }

    const running: RunningSession[] = [];
    for (const name of names) {
      let meta: SessionFile;
      try {
        meta = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as SessionFile;
      } catch {
        continue;   // being written, or removed since the listing
      }
      if (typeof meta.pid !== 'number' || typeof meta.sessionId !== 'string' || !isPidAlive(meta.pid)) { continue; }
      const procStart = typeof meta.procStart === 'string' ? meta.procStart : null;
      running.push({ pid: meta.pid, sessionId: meta.sessionId, procStart, meta });
    }

    const sessions = new Map<string, LiveSession>();
    for (const { sessionId, meta } of this.stillTheSameProcess(running)) {
      sessions.set(sessionId, {
        status: STATUSES.includes(meta.status as LiveStatus) ? meta.status as LiveStatus : null,
        waitingFor: typeof meta.waitingFor === 'string' ? meta.waitingFor : null,
      });
    }
    return { sessions, available: true };
  }

  /** Drops crash leftovers whose PID now belongs to some other process. */
  private stillTheSameProcess(running: RunningSession[]): RunningSession[] {
    const now = this.now();
    for (const [key, entry] of this.identity) {
      if (now - entry.checkedAt > IDENTITY_TTL_MS) { this.identity.delete(key); }
    }

    const unchecked = running.filter(r => r.procStart !== null && !this.identity.has(identityKey(r)));
    if (unchecked.length > 0) {
      const startTimes = processStartTimes(unchecked.map(r => r.pid));
      for (const r of unchecked) {
        // With no way to ask (no `ps`, e.g. on Windows), a live PID is the best evidence there is.
        const same = startTimes === null || sameInstant(startTimes.get(r.pid), r.procStart);
        this.identity.set(identityKey(r), { same, checkedAt: now });
      }
    }
    return running.filter(r => r.procStart === null || this.identity.get(identityKey(r))?.same);
  }
}

function identityKey(r: RunningSession): string {
  return `${r.pid}@${r.procStart}`;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// procStart is `ps -o lstart` output in UTC; single-digit days are space-padded.
function sameInstant(actual: string | undefined, recorded: string | null): boolean {
  const squash = (s: string) => s.trim().replace(/\s+/g, ' ');
  return actual !== undefined && recorded !== null && squash(actual) === squash(recorded);
}

/** Start time of each PID as `ps` prints it in UTC, or null when `ps` can't be run. */
export function processStartTimes(pids: number[]): Map<number, string> | null {
  let output: string;
  try {
    output = execFileSync('ps', ['-o', 'pid=,lstart=', '-p', pids.join(',')], {
      encoding: 'utf-8',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
      timeout: 2000,
    });
  } catch (err) {
    // ps exits 1 when some PIDs are gone, still listing the rest.
    const { status, stdout } = err as { status?: number; stdout?: unknown };
    if (status !== 1 || typeof stdout !== 'string') { return null; }
    output = stdout;
  }
  const starts = new Map<number, string>();
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
    if (match) { starts.set(Number(match[1]), match[2]); }
  }
  return starts;
}
