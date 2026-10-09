import { describe, it, expect } from 'vitest';
import { renderAgentsMd } from '../renderAgentsMd';
import { makeProject, makeProjectConfig, makeMemoryFile } from '../../__tests__/fixtures/sessions';

const AT = new Date('2026-08-06T12:00:00.000Z');

describe('renderAgentsMd', () => {
  it('titles the document and stamps a generation comment', () => {
    const md = renderAgentsMd(makeProject({ name: 'my-app' }), makeProjectConfig(), 0, AT);
    expect(md).toContain('# my-app');
    expect(md).toContain('2026-08-06T12:00:00.000Z');
  });

  it('copies CLAUDE.md verbatim, preserving blank lines inside code fences', () => {
    const claudeMd = '# Guide\n\n```ts\nconst a = 1;\n\n\nconst b = 2;\n```';
    const md = renderAgentsMd(makeProject(), makeProjectConfig({ claudeMd }), 0, AT);
    expect(md).toContain('const a = 1;\n\n\nconst b = 2;');
  });

  it('attributes CLAUDE.md without wrapping it in a heading that its own headings would outrank', () => {
    const claudeMd = '# Guide\n\n## Architecture\n\ndetails';
    const md = renderAgentsMd(makeProject(), makeProjectConfig({ claudeMd }), 3, AT);

    expect(md).not.toContain('## Project instructions');
    expect(md).toContain('> Project instructions, copied verbatim from `CLAUDE.md`.');
    // The rule closes the verbatim block before our own sections begin.
    expect(md.indexOf('\n---\n')).toBeGreaterThan(md.indexOf('## Architecture'));
    expect(md.indexOf('## Prior session history')).toBeGreaterThan(md.indexOf('\n---\n'));
  });

  it('omits every section whose source data is empty', () => {
    const md = renderAgentsMd(makeProject(), makeProjectConfig({ claudeMd: null }), 0, AT);
    for (const heading of ['Working knowledge', 'Plans', 'Custom commands', 'MCP servers', 'Automation', 'Prior session history']) {
      expect(md).not.toContain(`## ${heading}`);
    }
    expect(md).not.toContain('CLAUDE.md');
  });

  it('groups memory by type in a fixed order with unknown types last', () => {
    const config = makeProjectConfig({
      memory: {
        index: null,
        files: [
          makeMemoryFile({ name: 'z-custom', type: 'zzz' }),
          makeMemoryFile({ name: 'a-ref', type: 'reference' }),
          makeMemoryFile({ name: 'b-user', type: 'user' }),
          makeMemoryFile({ name: 'c-feedback', type: 'feedback' }),
        ],
      },
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);

    const order = ['About the user', 'Feedback and working agreements', 'References', 'Zzz']
      .map(heading => md.indexOf(`### ${heading}`));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('renders each memory name, description, and body', () => {
    const config = makeProjectConfig({
      memory: {
        index: null,
        files: [makeMemoryFile({ name: 'tabs', description: 'Prefers tabs.', content: 'Because alignment.' })],
      },
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);
    expect(md).toContain('- **tabs** — Prefers tabs.');
    expect(md).toContain('Because alignment.');
  });

  it('rewrites wikilinks in memory descriptions and bodies', () => {
    const config = makeProjectConfig({
      memory: {
        index: null,
        files: [makeMemoryFile({ description: 'See [[other-memory]].', content: 'Related: [[third-one]]' })],
      },
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);
    expect(md).toContain('See other-memory.');
    expect(md).toContain('Related: third-one');
    expect(md).not.toContain('[[');
  });

  it('lists plans by name, with the description only when present', () => {
    const config = makeProjectConfig({
      plans: [
        { fileName: 'migration.md', name: 'migration', description: 'Move to v2', content: 'body' },
        { fileName: 'cleanup.md', name: 'cleanup', description: '', content: 'body' },
      ],
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);
    expect(md).toContain('## Plans');
    expect(md).toContain('- **migration** — Move to v2');
    expect(md).toContain('- **cleanup**\n');
  });

  it('takes command descriptions from frontmatter, falling back to the first line', () => {
    const config = makeProjectConfig({
      commands: [
        { name: 'commit', content: '---\ndescription: Craft a commit\n---\nbody' },
        { name: 'review', content: 'Review the diff\nmore' },
      ],
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);
    expect(md).toContain('- `/commit` — Craft a commit');
    expect(md).toContain('- `/review` — Review the diff');
  });

  it('renders MCP servers and hooks as tables', () => {
    const config = makeProjectConfig({
      mcpServers: { codegraph: { name: 'codegraph', type: 'stdio', toolCallCount: 4 } },
      hooks: [{ event: 'PostToolUse', matcher: 'Edit', command: 'echo hi' }],
    });
    const md = renderAgentsMd(makeProject(), config, 0, AT);
    expect(md).toContain('| codegraph | stdio |');
    expect(md).toContain('| PostToolUse | Edit | `echo hi` |');
  });

  it('defaults a missing hook matcher to *', () => {
    const config = makeProjectConfig({ hooks: [{ event: 'Stop', command: 'echo bye' }] });
    expect(renderAgentsMd(makeProject(), config, 0, AT)).toContain('| Stop | * | `echo bye` |');
  });

  it('points at the index rather than inlining history, and says not to read it all', () => {
    const md = renderAgentsMd(makeProject(), makeProjectConfig(), 12, AT);
    expect(md).toContain('12 sessions indexed at `.agent-context/INDEX.md`');
    expect(md).toContain("don't read them all");
  });

  it('singularizes a one-session count', () => {
    expect(renderAgentsMd(makeProject(), makeProjectConfig(), 1, AT)).toContain('1 session indexed');
  });

  it('ends with exactly one trailing newline', () => {
    const md = renderAgentsMd(makeProject(), makeProjectConfig(), 3, AT);
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});
