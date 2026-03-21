export const TOOL_COLORS: Record<string, string> = {
  Read:       '#6366f1',
  Write:      '#22c55e',
  Edit:       '#f59e0b',
  MultiEdit:  '#f97316',
  Bash:       '#ef4444',
  Glob:       '#8b5cf6',
  Grep:       '#ec4899',
  Agent:      '#06b6d4',
  WebFetch:   '#14b8a6',
  WebSearch:  '#3b82f6',
};

export function toolColor(name: string): string {
  if (name.startsWith('mcp__')) { return '#06b6d4'; }
  return TOOL_COLORS[name] ?? '#6b7280';
}
