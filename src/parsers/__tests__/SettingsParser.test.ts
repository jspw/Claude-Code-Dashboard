import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsParser } from '../SettingsParser';

vi.mock('fs');

const asReadResult = (content: string): ReturnType<typeof fs.readFileSync> =>
  content as unknown as ReturnType<typeof fs.readFileSync>;
const asDirEntries = (entries: string[]): ReturnType<typeof fs.readdirSync> =>
  entries as unknown as ReturnType<typeof fs.readdirSync>;

describe('SettingsParser', () => {
  let parser: SettingsParser;

  beforeEach(() => {
    vi.resetAllMocks();
    parser = new SettingsParser();
  });

  it('reads global, user, and project json files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(asReadResult('{"hooks":{"Stop":[]}}'))
      .mockReturnValueOnce(asReadResult('{"mcpServers":{"github":{"command":"npx"}}}'))
      .mockReturnValueOnce(asReadResult('{"theme":"dark"}'))
      .mockReturnValueOnce(asReadResult('{"mcpServers":{"local":{"type":"stdio"}}}'));

    expect(parser.readGlobalSettings('/claude')).toEqual({ hooks: { Stop: [] } });
    expect(parser.readUserClaudeJson('/home/user')).toEqual({ mcpServers: { github: { command: 'npx' } } });
    expect(parser.readProjectSettings('/project')).toEqual({ theme: 'dark' });
    expect(parser.readProjectMcpJson('/project')).toEqual({ mcpServers: { local: { type: 'stdio' } } });
  });

  it('returns empty objects for missing or invalid json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(parser.readGlobalSettings('/claude')).toEqual({});

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => asReadResult('{not json'));
    expect(parser.readProjectSettings('/project')).toEqual({});
  });

  it('reads CLAUDE.md and project commands in sorted order', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) => String(file).includes('CLAUDE.md') || String(file).includes('commands'));
    vi.mocked(fs.readdirSync).mockReturnValue(asDirEntries(['zeta.md', 'alpha.md', 'notes.txt']));
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(asReadResult('# Rules'))
      .mockReturnValueOnce(asReadResult('alpha content'))
      .mockReturnValueOnce(asReadResult('zeta content'));

    expect(parser.readClaudeMd('/project')).toBe('# Rules');
    expect(parser.readProjectCommands('/project')).toEqual([
      { name: 'alpha', content: 'zeta content' },
      { name: 'zeta', content: 'alpha content' },
    ]);
  });

  it('reads project memory index and markdown files with frontmatter', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) => !String(file).endsWith('missing/memory'));
    vi.mocked(fs.readdirSync).mockReturnValue(asDirEntries(['zeta.md', 'MEMORY.md', 'alpha.md', 'broken.md', 'notes.txt']));
    vi.mocked(fs.readFileSync).mockImplementation((file) => {
      const target = String(file);
      if (target.endsWith('MEMORY.md')) {
        return asReadResult('# Memory Index');
      }
      if (target.endsWith('alpha.md')) {
        return asReadResult([
          '---',
          'name: Alpha Memory',
          'description: Useful notes',
          'type: user',
          '---',
          'Remember the alpha flow.',
        ].join('\n'));
      }
      if (target.endsWith('zeta.md')) {
        return asReadResult('Fallback content');
      }
      throw new Error('unreadable');
    });

    expect(parser.readProjectMemory('/claude', 'project-1')).toEqual({
      index: '# Memory Index',
      files: [
        {
          fileName: 'alpha.md',
          name: 'Alpha Memory',
          description: 'Useful notes',
          type: 'user',
          content: 'Remember the alpha flow.',
        },
        {
          fileName: 'zeta.md',
          name: 'zeta',
          description: '',
          type: 'unknown',
          content: 'Fallback content',
        },
      ],
    });
  });

  it('reads project plans from common locations and frontmatter', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) => {
      const target = String(file);
      return target.endsWith('PLAN.md') || target.includes('/.claude/plans') || target.endsWith('\\.claude\\plans');
    });
    vi.mocked(fs.readdirSync).mockReturnValue(asDirEntries(['delivery.md', 'notes.txt']));
    vi.mocked(fs.readFileSync).mockImplementation((file) => {
      const target = String(file);
      if (target.endsWith('PLAN.md')) {
        return asReadResult([
          '---',
          'name: Product Plan',
          'description: Main project roadmap',
          '---',
          '# Plan',
        ].join('\n'));
      }
      if (target.endsWith('delivery.md')) {
        return asReadResult('## Delivery Plan');
      }
      throw new Error('missing');
    });

    expect(parser.readProjectPlans('/project')).toEqual([
      {
        fileName: '.claude/plans/delivery.md',
        name: 'delivery',
        description: '',
        content: '## Delivery Plan',
      },
      {
        fileName: '.claude/PLAN.md',
        name: 'Product Plan',
        description: 'Main project roadmap',
        content: '# Plan',
      },
    ]);
  });

  it('returns null or empty arrays when markdown and command reads fail', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('denied');
    });
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error('denied');
    });

    expect(parser.readClaudeMd('/project')).toBeNull();
    expect(parser.readProjectCommands('/project')).toEqual([]);
    expect(parser.readProjectPlans('/project')).toEqual([]);
  });

  it('returns empty memory when the project memory directory is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(parser.readProjectMemory('/claude', 'missing')).toEqual({
      index: null,
      files: [],
    });
  });
});
