import { describe, it, expect } from 'vitest';
import { renderIndex } from '../renderIndex';
import type { TranscriptEntry } from '../types';

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    sessionId: 'abc',
    startTime: Date.parse('2026-08-06T09:00:00.000Z'),
    summary: 'Fix the bug',
    files: ['src/a.ts'],
    fileName: '2026-08-06-fix-the-bug.md',
    ...overrides,
  };
}

describe('renderIndex', () => {
  it('renders a row per entry with a relative transcript link', () => {
    const md = renderIndex([entry()]);
    expect(md).toContain('| 2026-08-06 | Fix the bug | `src/a.ts` | [open](sessions/2026-08-06-fix-the-bug.md) |');
  });

  it('preserves the order it is given', () => {
    const md = renderIndex([
      entry({ summary: 'newer', fileName: 'b.md' }),
      entry({ summary: 'older', fileName: 'a.md' }),
    ]);
    expect(md.indexOf('newer')).toBeLessThan(md.indexOf('older'));
  });

  it('caps the file list at five with a +N more suffix', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(n => `src/${n}.ts`);
    const md = renderIndex([entry({ files })]);
    expect(md).toContain('+2 more');
    expect(md).not.toContain('src/f.ts');
  });

  it('shows an em dash when no files were touched', () => {
    expect(renderIndex([entry({ files: [] })])).toContain('| — |');
  });

  it('shows an em dash for a missing summary', () => {
    const md = renderIndex([entry({ summary: null })]);
    expect(md).toContain('| 2026-08-06 | — |');
  });

  it('escapes pipes in summaries so the table survives', () => {
    const md = renderIndex([entry({ summary: 'a | b' })]);
    expect(md).toContain('a \\| b');
  });

  it('renders a header even with no entries', () => {
    const md = renderIndex([]);
    expect(md).toContain('# Session history');
    expect(md).toContain('| Date | Summary | Files touched | Transcript |');
  });
});
