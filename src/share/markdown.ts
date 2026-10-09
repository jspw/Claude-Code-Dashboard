import * as path from 'path';

/** Escapes a value for use inside a markdown table cell. */
export function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/** Renders a value as a double-quoted YAML scalar, safe for any content. */
export function yamlString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Rewrites `[[wikilink]]` references to their plain display name.
 * The syntax is Claude-Code-specific and meaningless to other agents.
 */
export function stripWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/** Truncates to `max` characters, appending an ellipsis when it cuts. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** Converts arbitrary text into a filename-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Makes an absolute path project-relative; leaves anything outside the project as-is. */
export function toProjectRelative(filePath: string, projectPath: string): string {
  if (!projectPath || !path.isAbsolute(filePath)) { return filePath; }
  const relative = path.relative(projectPath, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { return filePath; }
  return relative;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces the user's home directory with `~`, both as a path and in the
 * dash-encoded form Claude Code uses for project folders (`-Users-me-…`),
 * which spells out the username just the same. Matches only where the name
 * ends, so a sibling like `/Users/meow` is left alone.
 */
export function redactHome(text: string, homeDir: string): string {
  if (!homeDir) { return text; }
  const encoded = homeDir.replace(/[^A-Za-z0-9]/g, '-');
  return text
    .replace(new RegExp(`${escapeRegExp(homeDir)}(?![\\w.-])`, 'g'), '~')
    .replace(new RegExp(`${escapeRegExp(encoded)}(?![A-Za-z0-9])`, 'g'), '-~');
}

/** Splits YAML frontmatter from a markdown body. */
export function splitFrontmatter(raw: string): { frontmatter: string | null; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) { return { frontmatter: null, body: raw }; }
  return { frontmatter: match[1], body: match[2].trim() };
}

/**
 * Extracts a description for a custom command. `ProjectConfig.commands` carries
 * only `{ name, content }`, so the description comes from frontmatter when
 * present and falls back to the first non-empty body line.
 */
export function commandDescription(content: string): string {
  const { frontmatter, body } = splitFrontmatter(content);
  const fromFrontmatter = frontmatter?.match(/^description:\s*(.+)$/m);
  if (fromFrontmatter) { return fromFrontmatter[1].trim(); }

  const firstLine = body
    .split('\n')
    .map(line => line.replace(/^#+\s*/, '').trim())
    .find(line => line.length > 0);
  return firstLine ?? '';
}
