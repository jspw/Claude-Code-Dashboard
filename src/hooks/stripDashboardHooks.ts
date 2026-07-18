/**
 * Removes every dashboard-injected hook entry from a parsed ~/.claude/settings.json
 * object. Shared by HookManager (disable command) and the vscode:uninstall script,
 * which runs outside the extension host and cannot import 'vscode'.
 */
export function stripDashboardHooks(settings: Record<string, unknown>): boolean {
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks || typeof hooks !== 'object') { return false; }

  let changed = false;
  for (const key of Object.keys(hooks)) {
    const entries = hooks[key];
    if (!Array.isArray(entries)) { continue; }
    const kept = entries.filter(h => !JSON.stringify(h).includes('.dashboard-events.jsonl'));
    if (kept.length !== entries.length) {
      changed = true;
      if (kept.length === 0) {
        delete hooks[key];
      } else {
        hooks[key] = kept;
      }
    }
  }
  if (changed && Object.keys(hooks).length === 0) {
    delete settings.hooks;
  }
  return changed;
}
