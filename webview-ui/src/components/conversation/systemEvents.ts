// Parsing of system-injected "user" messages (slash commands, stdout echoes,
// skill instruction payloads) so they render as context rows, not prompts.

export type SystemEvent =
  | { kind: 'command'; name: string; args?: string }
  | { kind: 'stdout'; text: string }
  | { kind: 'skill'; name: string; body: string };

// Loading a skill injects its full instructions as a "user" message that begins
// with this marker. These can be hundreds of KB — surface them as collapsed
// context rather than a user turn.
const SKILL_INJECTION_PREFIX = 'Base directory for this skill:';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
export function stripAnsi(s: string): string { return s.replace(ANSI_RE, ''); }

export function parseSystemContent(content: string): SystemEvent | 'skip' | null {
  const t = content.trim();
  if (/<local-command-caveat>/i.test(t) && !t.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '').trim()) {
    return 'skip';
  }
  if (t.startsWith(SKILL_INJECTION_PREFIX)) {
    const nl = t.indexOf('\n');
    const firstLine = nl === -1 ? t : t.slice(0, nl);
    const dir = firstLine.slice(SKILL_INJECTION_PREFIX.length).trim();
    const name = dir.split('/').filter(Boolean).pop() || 'skill';
    return { kind: 'skill', name, body: t.slice(firstLine.length).trim() };
  }
  const cmdMatch = t.match(/<command-name>([^<]+)<\/command-name>/);
  if (cmdMatch) {
    const argsMatch = t.match(/<command-args>([\s\S]*?)<\/command-args>/);
    const args = argsMatch?.[1]?.trim() || undefined;
    return { kind: 'command', name: cmdMatch[1].trim(), args };
  }
  const stdoutMatch = t.match(/<(?:local-command-stdout|command-stdout)>([\s\S]*?)<\/(?:local-command-stdout|command-stdout)>/);
  if (stdoutMatch) {
    const text = stripAnsi(stdoutMatch[1].trim());
    return text ? { kind: 'stdout', text } : 'skip';
  }
  return null;
}
