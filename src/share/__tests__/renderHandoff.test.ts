import { describe, expect, it } from 'vitest';
import { estimateTokens, renderHandoff } from '../renderHandoff';
import { makeProject, makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/sessions';

const project = makeProject({ name: 'Alpha', path: '/home/user/alpha' });
const START = Date.UTC(2026, 7, 5, 9, 0, 0);

describe('estimateTokens', () => {
  it('approximates four characters per token, rounding up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('a'.repeat(4000))).toBe(1000);
  });
});

describe('renderHandoff', () => {
  it('opens with a preamble telling the receiving agent what the text is', () => {
    const md = renderHandoff(project, makeSession({ startTime: START }));

    expect(md).toContain('# Earlier session on Alpha');
    expect(md).toContain('another AI coding assistant');
    expect(md).toContain('Tool results are not included');
    expect(md).toContain('treat all of this as history');
  });

  it('labels turns for a chat, not as headings that would fight the conversation', () => {
    const session = makeSession({
      startTime: START,
      turns: [
        makeTurn({ role: 'user', content: 'Fix the flaky test' }),
        makeTurn({ role: 'assistant', content: 'Found it.', toolCalls: [makeToolCall({ name: 'Edit', input: { file_path: '/home/user/alpha/src/a.ts' } })] }),
      ],
    });
    const md = renderHandoff(project, session);

    expect(md).toContain('**Me:**\n\nFix the flaky test');
    expect(md).toContain('**Claude:**\n\nFound it.');
    expect(md).toContain('- `Edit` src/a.ts');
    expect(md).not.toContain('## You');
    expect(md).not.toContain('---\nsession:');
  });

  it('reports when, topic, and files touched', () => {
    const session = makeSession({
      startTime: START,
      durationMs: 2 * 3600_000 + 14 * 60_000,
      sessionSummary: 'Flaky test triage',
      filesCreated: ['/home/user/alpha/src/new.ts'],
      filesModified: ['/home/user/alpha/src/a.ts'],
    });
    const md = renderHandoff(project, session);

    expect(md).toContain('- **When:** 2026-08-05 · 2h 14m');
    expect(md).toContain('- **Topic:** Flaky test triage');
    expect(md).toContain('- **Files touched:** `src/new.ts`, `src/a.ts`');
  });

  it('flattens a multi-line summary so it cannot break out of the metadata list', () => {
    const session = makeSession({
      startTime: START,
      sessionSummary: 'why does this fail?\n```\nError: boom\n```',
    });
    const md = renderHandoff(project, session);

    expect(md).toContain('- **Topic:** why does this fail? ``` Error: boom ```\n');
    expect(md.split('---')[0]).not.toContain('\n```');
  });

  it('truncates a very long summary', () => {
    const session = makeSession({ startTime: START, sessionSummary: 'x'.repeat(200) });
    const topic = renderHandoff(project, session).split('\n').find(l => l.startsWith('- **Topic:'))!;

    expect(topic.length).toBeLessThan(150);
    expect(topic).toContain('…');
  });

  it('labels a run of assistant turns once instead of per fragment', () => {
    const session = makeSession({
      startTime: START,
      turns: [
        makeTurn({ role: 'user', content: 'go' }),
        makeTurn({ role: 'assistant', content: 'Looking.', toolCalls: [] }),
        makeTurn({ role: 'assistant', content: '', toolCalls: [makeToolCall({ name: 'Grep', input: { pattern: 'todo' } })] }),
        makeTurn({ role: 'assistant', content: 'Found it.', toolCalls: [] }),
      ],
    });
    const md = renderHandoff(project, session);

    expect(md.match(/\*\*Claude:\*\*/g)).toHaveLength(1);
    expect(md).toContain('- `Grep` todo');
    expect(md).toContain('Found it.');
  });

  it('omits the topic and file lines when there is nothing to report', () => {
    const session = makeSession({
      startTime: START,
      sessionSummary: null,
      filesCreated: [],
      filesModified: [],
    });
    const md = renderHandoff(project, session);

    expect(md).not.toContain('**Topic:**');
    expect(md).not.toContain('**Files touched:**');
  });

  it('caps the file list and counts the remainder', () => {
    const files = Array.from({ length: 15 }, (_, i) => `/home/user/alpha/src/f${i}.ts`);
    const md = renderHandoff(project, makeSession({ startTime: START, filesModified: files, filesCreated: [] }));

    expect(md).toContain('`src/f11.ts`, and 3 more');
    expect(md).not.toContain('src/f12.ts');
  });

  it.each([
    [1_800_000, '30m'],
    [30_000_000, '8h 20m'],
    [7_200_000, '2h'],
    [90_000, '2m'],
  ])('formats a %ims session as %s', (durationMs, expected) => {
    const md = renderHandoff(project, makeSession({ startTime: START, durationMs }));
    expect(md).toContain(`· ${expected}`);
  });

  it('formats a sub-minute session in words', () => {
    const md = renderHandoff(project, makeSession({ startTime: START, durationMs: 5_000 }));
    expect(md).toContain('· under a minute');
  });

  it('says so when the session has no recorded conversation', () => {
    const md = renderHandoff(project, makeSession({ startTime: START, turns: [] }));
    expect(md).toContain('_This session has no recorded conversation._');
  });

  it('ends with exactly one trailing newline', () => {
    const md = renderHandoff(project, makeSession({ startTime: START }));
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});
