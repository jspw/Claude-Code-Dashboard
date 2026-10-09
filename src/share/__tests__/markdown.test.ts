import { describe, it, expect } from 'vitest';
import {
  commandDescription,
  escapeTableCell,
  redactHome,
  slugify,
  splitFrontmatter,
  stripWikiLinks,
  toProjectRelative,
  truncate,
  yamlString,
} from '../markdown';

describe('escapeTableCell', () => {
  it('escapes pipes so cells cannot break the table', () => {
    expect(escapeTableCell('a | b')).toBe('a \\| b');
  });

  it('flattens newlines to spaces', () => {
    expect(escapeTableCell('line one\nline two')).toBe('line one line two');
  });
});

describe('yamlString', () => {
  it('quotes values containing YAML-significant characters', () => {
    expect(yamlString('summary: with colon')).toBe('"summary: with colon"');
  });

  it('escapes embedded quotes and newlines', () => {
    expect(yamlString('say "hi"\nbye')).toBe('"say \\"hi\\"\\nbye"');
  });
});

describe('stripWikiLinks', () => {
  it('rewrites wikilinks to their plain display name', () => {
    expect(stripWikiLinks('see [[commit-style]] for details')).toBe('see commit-style for details');
  });

  it('handles multiple links in one string', () => {
    expect(stripWikiLinks('[[a]] and [[b]]')).toBe('a and b');
  });

  it('leaves text without links untouched', () => {
    expect(stripWikiLinks('no links here')).toBe('no links here');
  });
});

describe('truncate', () => {
  it('leaves short values alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('appends an ellipsis when it cuts', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…');
  });
});

describe('slugify', () => {
  it('lowercases and collapses non-alphanumerics', () => {
    expect(slugify('Fix the Bug in index.ts!')).toBe('fix-the-bug-in-index-ts');
  });

  it('caps length at 60 characters without a trailing hyphen', () => {
    const slug = slugify('a'.repeat(80));
    expect(slug.length).toBe(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('toProjectRelative', () => {
  const root = '/home/user/proj';

  it('relativizes paths inside the project', () => {
    expect(toProjectRelative('/home/user/proj/src/a.ts', root)).toBe('src/a.ts');
  });

  it('leaves paths outside the project absolute', () => {
    expect(toProjectRelative('/etc/hosts', root)).toBe('/etc/hosts');
  });

  it('leaves already-relative paths alone', () => {
    expect(toProjectRelative('src/a.ts', root)).toBe('src/a.ts');
  });
});

describe('splitFrontmatter', () => {
  it('separates frontmatter from body', () => {
    const { frontmatter, body } = splitFrontmatter('---\nname: x\n---\nBody here');
    expect(frontmatter).toBe('name: x');
    expect(body).toBe('Body here');
  });

  it('returns the whole input as body when there is no frontmatter', () => {
    const { frontmatter, body } = splitFrontmatter('Just a body');
    expect(frontmatter).toBeNull();
    expect(body).toBe('Just a body');
  });
});

describe('commandDescription', () => {
  it('prefers the frontmatter description', () => {
    const content = '---\nname: commit\ndescription: Make a commit\n---\nBody text';
    expect(commandDescription(content)).toBe('Make a commit');
  });

  it('falls back to the first non-empty body line', () => {
    expect(commandDescription('\n\nDo the thing\nmore text')).toBe('Do the thing');
  });

  it('strips heading markers from the fallback line', () => {
    expect(commandDescription('# Commit helper\n\nbody')).toBe('Commit helper');
  });

  it('returns an empty string for empty content', () => {
    expect(commandDescription('')).toBe('');
  });
});

describe('redactHome', () => {
  const HOME = '/Users/me';

  it('replaces the home directory with ~', () => {
    expect(redactHome('Read /Users/me/.claude/notes.md', HOME)).toBe('Read ~/.claude/notes.md');
    expect(redactHome('cd /Users/me && ls', HOME)).toBe('cd ~ && ls');
  });

  it('replaces the home directory inside Claude Code folder names', () => {
    expect(redactHome('~/.claude/projects/-Users-me-Documents-Paper/memory', HOME))
      .toBe('~/.claude/projects/-~-Documents-Paper/memory');
  });

  it('leaves siblings that merely share the home path as a prefix', () => {
    expect(redactHome('/Users/meow/x and /Users/me.bak and -Users-meow-x', HOME))
      .toBe('/Users/meow/x and /Users/me.bak and -Users-meow-x');
  });

  it('leaves text alone without a home directory', () => {
    expect(redactHome('/Users/me/x', '')).toBe('/Users/me/x');
  });
});
