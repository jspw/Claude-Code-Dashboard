import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeSettings {
  hooks?: Record<string, unknown[]>;
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

type ParsedMarkdownFile = {
  name: string;
  description: string;
  content: string;
};

export class SettingsParser {
  private readJson(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) { return {}; }
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return {}; }
  }

  private parseMarkdownFile(raw: string, fallbackName: string): ParsedMarkdownFile {
    let name = fallbackName;
    let description = '';
    let content = raw;

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const fm = fmMatch[1];
      content = fmMatch[2].trim();
      const nameMatch = fm.match(/^name:\s*(.+)$/m);
      const descMatch = fm.match(/^description:\s*(.+)$/m);
      if (nameMatch) { name = nameMatch[1].trim(); }
      if (descMatch) { description = descMatch[1].trim(); }
    }

    return { name, description, content };
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

  readProjectMemory(claudeDir: string, projectId: string): { index: string | null; files: { fileName: string; name: string; description: string; type: string; content: string }[] } {
    const memDir = path.join(claudeDir, 'projects', projectId, 'memory');
    if (!fs.existsSync(memDir)) { return { index: null, files: [] }; }

    let index: string | null = null;
    const indexPath = path.join(memDir, 'MEMORY.md');
    try { if (fs.existsSync(indexPath)) { index = fs.readFileSync(indexPath, 'utf-8'); } } catch { /* ignore */ }

    const files: { fileName: string; name: string; description: string; type: string; content: string }[] = [];
    try {
      const entries = fs.readdirSync(memDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
      for (const file of entries) {
        try {
          const raw = fs.readFileSync(path.join(memDir, file), 'utf-8');
          const parsed = this.parseMarkdownFile(raw, file.replace(/\.md$/, ''));
          let type = 'unknown';
          let content = parsed.content;

          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          if (fmMatch) {
            const fm = fmMatch[1];
            const typeMatch = fm.match(/^type:\s*(.+)$/m);
            if (typeMatch) { type = typeMatch[1].trim(); }
          }

          files.push({ fileName: file, name: parsed.name, description: parsed.description, type, content });
        } catch { /* skip unreadable */ }
      }
    } catch { /* ignore */ }
    return { index, files: files.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  readProjectPlans(projectPath: string): { fileName: string; name: string; description: string; content: string }[] {
    const rootCandidates = ['PLAN.md', 'PLANS.md', 'plan.md', 'plans.md'];
    const claudeCandidates = rootCandidates.map(file => path.join('.claude', file));
    const planDir = path.join(projectPath, '.claude', 'plans');
    const discovered = new Map<string, string>();

    for (const relativePath of [...rootCandidates, ...claudeCandidates]) {
      const fullPath = path.join(projectPath, relativePath);
      if (fs.existsSync(fullPath)) {
        discovered.set(path.basename(relativePath).toLowerCase(), fullPath);
      }
    }

    if (fs.existsSync(planDir)) {
      try {
        const planFiles = fs.readdirSync(planDir).filter(file => file.endsWith('.md'));
        for (const file of planFiles) {
          discovered.set(path.join('plans', file).toLowerCase(), path.join(planDir, file));
        }
      } catch { /* ignore */ }
    }

    const plans: { fileName: string; name: string; description: string; content: string }[] = [];
    for (const fullPath of discovered.values()) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = this.parseMarkdownFile(raw, path.basename(fullPath, '.md'));
        plans.push({
          fileName: path.relative(projectPath, fullPath),
          name: parsed.name,
          description: parsed.description,
          content: parsed.content,
        });
      } catch { /* ignore */ }
    }

    return plans.sort((a, b) => a.name.localeCompare(b.name));
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
