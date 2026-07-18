import * as fs from 'fs';
import * as path from 'path';
import { stripDashboardHooks } from './stripDashboardHooks';

// The injected hook exits immediately unless the marker file exists, so a stale
// hook entry (e.g. restored from a settings backup) costs one existsSync and
// writes nothing.
const HOOK_COMMAND = `node -e "const f=require('fs'),p=require('path'),dir=p.join(require('os').homedir(),'.claude');if(!f.existsSync(p.join(dir,'.dashboard-live'))){process.exit(0)}process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const e=JSON.parse(d);const line=JSON.stringify({type:e.hook_event_name,tool:e.tool_name,sessionId:e.session_id,timestamp:Date.now()})+'\\n';f.appendFileSync(p.join(dir,'.dashboard-events.jsonl'),line)}catch(err){}})"`;

const HOOK_VERSION = 3;
export const LIVE_MARKER_FILE = '.dashboard-live';

export class HookManager {
  private claudeDir: string;

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
  }

  /** Check if hooks need re-injection (version mismatch or missing) */
  needsReinjection(globalState: { get(key: string): unknown }): boolean {
    const storedVersion = globalState.get('dashboardHookVersion') as number | undefined;
    return storedVersion !== HOOK_VERSION;
  }

  async injectHooks(globalState?: { get(key: string): unknown; update(key: string, value: unknown): Thenable<void> }): Promise<void> {
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    let settings: Record<string, unknown> = {};

    if (fs.existsSync(settingsPath)) {
      try {
        // Backup before modifying
        fs.copyFileSync(settingsPath, settingsPath + '.bak');
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch { settings = {}; }
    }

    const dashboardHook = { type: 'command', command: HOOK_COMMAND };

    const hooks = (settings.hooks as Record<string, unknown[]>) || {};

    // Remove old dashboard hooks before re-injecting
    const removeOldHooks = (arr: unknown[]): unknown[] =>
      arr.filter(h => !JSON.stringify(h).includes('.dashboard-events.jsonl'));

    // PostToolUse hook
    const postToolUse = removeOldHooks((hooks.PostToolUse as unknown[]) || []);
    postToolUse.push({ matcher: '*', hooks: [dashboardHook] });
    hooks.PostToolUse = postToolUse;

    // Stop hook
    const stopHooks = removeOldHooks((hooks.Stop as unknown[]) || []);
    stopHooks.push({ hooks: [dashboardHook] });
    hooks.Stop = stopHooks;

    settings.hooks = hooks;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // Marker file arms the injected hooks (they no-op without it)
    fs.writeFileSync(
      path.join(this.claudeDir, LIVE_MARKER_FILE),
      'Claude Code Dashboard live tracking is enabled.\nDeleting this file disables the injected hooks without editing settings.json.\n'
    );

    // Store version so we know when to re-inject
    if (globalState) {
      await globalState.update('dashboardHookVersion', HOOK_VERSION);
    }
  }

  /** Remove all dashboard hooks from settings.json and disarm any stale copies. */
  async removeHooks(globalState?: { update(key: string, value: unknown): Thenable<void> }): Promise<void> {
    // Delete the marker first so any hook copy stops writing immediately
    try { fs.unlinkSync(path.join(this.claudeDir, LIVE_MARKER_FILE)); } catch { /* not present */ }

    const settingsPath = path.join(this.claudeDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
        if (stripDashboardHooks(settings)) {
          fs.copyFileSync(settingsPath, settingsPath + '.bak');
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        }
      } catch { /* unreadable settings — leave untouched */ }
    }

    if (globalState) {
      await globalState.update('dashboardHookVersion', undefined);
    }
  }
}
