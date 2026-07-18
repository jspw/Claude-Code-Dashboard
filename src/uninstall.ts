/**
 * Runs via the package.json "vscode:uninstall" hook after the extension is
 * uninstalled (plain Node, no 'vscode' module available). Cleans up everything
 * the dashboard added to ~/.claude so no orphaned hooks keep writing events.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripDashboardHooks } from './hooks/stripDashboardHooks';
import { LIVE_MARKER_FILE } from './hooks/HookManager';

const claudeDir = path.join(os.homedir(), '.claude');

try { fs.unlinkSync(path.join(claudeDir, LIVE_MARKER_FILE)); } catch { /* not present */ }

const settingsPath = path.join(claudeDir, 'settings.json');
try {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
  if (stripDashboardHooks(settings)) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
} catch { /* no settings or unreadable — nothing to clean */ }

try { fs.unlinkSync(path.join(claudeDir, '.dashboard-events.jsonl')); } catch { /* not present */ }
