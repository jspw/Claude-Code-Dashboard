import { describe, expect, it } from 'vitest';
import { TOOL_COLORS, toolColor } from '../toolColor';

describe('toolColor', () => {
  it('returns known tool colors, mcp colors, and a fallback', () => {
    expect(toolColor('Read')).toBe(TOOL_COLORS.Read);
    expect(toolColor('mcp__github__search')).toBe('#06b6d4');
    expect(toolColor('UnknownTool')).toBe('#6b7280');
  });
});
