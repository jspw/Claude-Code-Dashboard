import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeSettings {
  hooks?: Record<string, unknown[]>;
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

export class SettingsParser {
  private readJson(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) { return {}; }
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return {}; }
  }

  readGlobalSettings(claudeDir: string): ClaudeSettings {
    return this.readJson(path.join(claudeDir, 'settings.json'));
  }

  // ~/.claude.json — user-scoped MCP servers (local & user scope)
  readUserClaudeJson(homeDir: string): ClaudeSettings {
    return this.readJson(path.join(homeDir, '.claude.json'));
  }

  readProjectSettings(projectPath: string): ClaudeSettings {
    return this.readJson(path.join(projectPath, '.claude', 'settings.json'));
  }

  // {project}/.mcp.json — project-scoped team-shared MCP servers
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
