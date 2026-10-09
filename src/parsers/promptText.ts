// Detection mirrors webview-ui/src/components/conversation/systemEvents.ts,
// which the backend cannot import.
const SKILL_INJECTION_PREFIX = 'Base directory for this skill:';
const CAVEAT_RE = /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi;

/**
 * What a user message actually said, or null when it is not the user speaking.
 * Claude Code records skill instructions and local command output as user
 * messages; both are dropped like tool output. A slash command reads as typed.
 *
 * Entries flagged `isMeta` are injected too, but callers check that flag on the
 * raw entry — older logs predate it, which is why the content checks remain.
 */
export function promptText(content: string): string | null {
  if (!content.replace(CAVEAT_RE, '').trim()) { return null; }
  if (content.startsWith(SKILL_INJECTION_PREFIX)) { return null; }

  const command = content.match(/<command-name>([^<]+)<\/command-name>/);
  if (command) {
    const args = content.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1]?.trim();
    return args ? `${command[1].trim()} ${args}` : command[1].trim();
  }

  if (/<(?:local-command-stdout|command-stdout)>/.test(content)) { return null; }
  return content;
}
