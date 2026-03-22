import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsParser } from '../SettingsParser';

vi.mock('fs');

describe('SettingsParser', () => {
  let parser: SettingsParser;

  beforeEach(() => {
    vi.resetAllMocks();
    parser = new SettingsParser();
  });

  it('reads global, user, and project json files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('{"hooks":{"Stop":[]}}' as any)
      .mockReturnValueOnce('{"mcpServers":{"github":{"command":"npx"}}}' as any)
      .mockReturnValueOnce('{"theme":"dark"}' as any)
      .mockReturnValueOnce('{"mcpServers":{"local":{"type":"stdio"}}}' as any);

    expect(parser.readGlobalSettings('/claude')).toEqual({ hooks: { Stop: [] } });
    expect(parser.readUserClaudeJson('/home/user')).toEqual({ mcpServers: { github: { command: 'npx' } } });
    expect(parser.readProjectSettings('/project')).toEqual({ theme: 'dark' });
    expect(parser.readProjectMcpJson('/project')).toEqual({ mcpServers: { local: { type: 'stdio' } } });
  });

  it('returns empty objects for missing or invalid json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(parser.readGlobalSettings('/claude')).toEqual({});

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => '{not json' as any);
    expect(parser.readProjectSettings('/project')).toEqual({});
  });

  it('reads CLAUDE.md and project commands in sorted order', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) => String(file).includes('CLAUDE.md') || String(file).includes('commands'));
    vi.mocked(fs.readdirSync).mockReturnValue(['zeta.md', 'alpha.md', 'notes.txt'] as any);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('# Rules' as any)
      .mockReturnValueOnce('alpha content' as any)
      .mockReturnValueOnce('zeta content' as any);

    expect(parser.readClaudeMd('/project')).toBe('# Rules');
    expect(parser.readProjectCommands('/project')).toEqual([
      { name: 'alpha', content: 'zeta content' },
      { name: 'zeta', content: 'alpha content' },
    ]);
  });
});
