# Test Spec: SettingsParser

## Target File
`src/parsers/__tests__/SettingsParser.test.ts`

## Source Under Test
`src/parsers/SettingsParser.ts`

## Imports

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsParser } from '../SettingsParser';
import * as fs from 'fs';

vi.mock('fs');
```

## Setup

```typescript
let parser: SettingsParser;

beforeEach(() => {
  vi.resetAllMocks();
  parser = new SettingsParser();
});
```

## Helper

```typescript
const mockExistsSync = (val: boolean) =>
  (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(val);

const mockReadFileSync = (content: string) =>
  (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(content);

const mockReaddirSync = (files: string[]) =>
  (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(files);
```

## Test Cases (12 total)

### describe('readGlobalSettings')

#### 1. reads settings.json from claudeDir
- `mockExistsSync(true)`
- `mockReadFileSync(JSON.stringify({ hooks: { PostToolUse: [] }, apiKey: 'test' }))`
- `const result = parser.readGlobalSettings('/home/user/.claude')`
- Assert `result.hooks` deep equals `{ PostToolUse: [] }`
- Assert `result.apiKey` equals `'test'`
- Assert `fs.existsSync` was called with path ending in `'settings.json'`

#### 2. returns {} if settings.json missing
- `mockExistsSync(false)`
- `const result = parser.readGlobalSettings('/home/user/.claude')`
- Assert `result` deep equals `{}`

#### 3. returns {} on parse error
- `mockExistsSync(true)`
- `mockReadFileSync('not valid json {{{')`
- `const result = parser.readGlobalSettings('/home/user/.claude')`
- Assert `result` deep equals `{}`

### describe('readUserClaudeJson')

#### 4. reads ~/.claude.json
- `mockExistsSync(true)`
- `mockReadFileSync(JSON.stringify({ mcpServers: { github: { command: 'gh' } } }))`
- `const result = parser.readUserClaudeJson('/home/user')`
- Assert `result.mcpServers` is defined
- Assert `(result.mcpServers as any).github.command` equals `'gh'`
- Assert `fs.existsSync` was called with path containing `.claude.json`

### describe('readProjectSettings')

#### 5. reads project/.claude/settings.json
- `mockExistsSync(true)`
- `mockReadFileSync(JSON.stringify({ mcpServers: { local: { command: 'node' } } }))`
- `const result = parser.readProjectSettings('/home/user/my-project')`
- Assert `result.mcpServers` is defined
- Assert `fs.existsSync` was called with a path containing `.claude/settings.json`

### describe('readProjectMcpJson')

#### 6. reads project/.mcp.json
- `mockExistsSync(true)`
- `mockReadFileSync(JSON.stringify({ mcpServers: { shared: { url: 'http://localhost:3000' } } }))`
- `const result = parser.readProjectMcpJson('/home/user/my-project')`
- Assert `result.mcpServers` is defined
- Assert `fs.existsSync` was called with a path containing `.mcp.json`

### describe('readClaudeMd')

#### 7. reads CLAUDE.md
- `mockExistsSync(true)`
- `mockReadFileSync('# Project Instructions\nDo this and that.')`
- `const result = parser.readClaudeMd('/home/user/my-project')`
- Assert `result` equals `'# Project Instructions\nDo this and that.'`

#### 8. returns null if CLAUDE.md missing
- `mockExistsSync(false)`
- `const result = parser.readClaudeMd('/home/user/my-project')`
- Assert `result` is `null`

### describe('readProjectCommands')

#### 9. reads .md files from commands dir
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `mockReaddirSync(['deploy.md', 'lint.md', 'README.txt'])`
- Mock `readFileSync` to return different content based on the file path:
```typescript
(fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
  if (filePath.includes('deploy.md')) return 'Deploy instructions';
  if (filePath.includes('lint.md')) return 'Lint config';
  return '';
});
```
- `const result = parser.readProjectCommands('/home/user/my-project')`
- Assert `result.length` equals `2` (only .md files, not .txt)
- Assert result contains `{ name: 'deploy', content: 'Deploy instructions' }`
- Assert result contains `{ name: 'lint', content: 'Lint config' }`

#### 10. sorts alphabetically
- Same setup as above
- Assert `result[0].name` equals `'deploy'`
- Assert `result[1].name` equals `'lint'`

#### 11. returns empty if commands dir missing
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false)`
- `const result = parser.readProjectCommands('/home/user/my-project')`
- Assert `result` deep equals `[]`

#### 12. skips unreadable files
- `(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)`
- `mockReaddirSync(['good.md', 'bad.md'])`
- Mock `readFileSync` to throw on bad.md:
```typescript
(fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
  if (filePath.includes('bad.md')) throw new Error('EACCES');
  return 'Good content';
});
```
- `const result = parser.readProjectCommands('/home/user/my-project')`
- Assert `result.length` equals `1`
- Assert `result[0].name` equals `'good'`

## Source Reference

```typescript
export class SettingsParser {
  private readJson(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) { return {}; }
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return {}; }
  }

  readGlobalSettings(claudeDir: string): ClaudeSettings {
    return this.readJson(path.join(claudeDir, 'settings.json'));
  }

  readUserClaudeJson(homeDir: string): ClaudeSettings {
    return this.readJson(path.join(homeDir, '.claude.json'));
  }

  readProjectSettings(projectPath: string): ClaudeSettings {
    return this.readJson(path.join(projectPath, '.claude', 'settings.json'));
  }

  readProjectMcpJson(projectPath: string): ClaudeSettings {
    return this.readJson(path.join(projectPath, '.mcp.json'));
  }

  readClaudeMd(dirPath: string): string | null {
    const mdPath = path.join(dirPath, 'CLAUDE.md');
    if (!fs.existsSync(mdPath)) { return null; }
    try { return fs.readFileSync(mdPath, 'utf-8'); } catch { return null; }
  }

  readProjectCommands(projectPath: string): { name: string; content: string }[] {
    const commandsDir = path.join(projectPath, '.claude', 'commands');
    if (!fs.existsSync(commandsDir)) { return []; }
    const commands: { name: string; content: string }[] = [];
    try {
      const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
          commands.push({ name: file.replace(/\.md$/, ''), content });
        } catch { /* skip unreadable */ }
      }
    } catch { /* ignore */ }
    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }
}
```

## Validation Criteria
- All 12 tests pass
- No real filesystem access (fs is fully mocked)
- Each test is independent (beforeEach resets mocks)
- Verify correct file paths are constructed (use `toHaveBeenCalledWith` or check call args contain expected path segments)
