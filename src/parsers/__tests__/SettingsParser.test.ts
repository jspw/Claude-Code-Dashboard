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
  });
});
