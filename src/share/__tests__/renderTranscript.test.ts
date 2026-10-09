import { describe, it, expect } from 'vitest';
import { primaryArg, renderTranscript, sessionFiles } from '../renderTranscript';
import { makeSession, makeTurn, makeToolCall } from '../../__tests__/fixtures/sessions';

const ROOT = '/home/user/test-project';

describe('primaryArg', () => {
  it('prefers file_path and relativizes it', () => {
    const call = makeToolCall({ input: { file_path: `${ROOT}/src/a.ts`, limit: 5 } });
    expect(primaryArg(call, ROOT)).toBe('src/a.ts');
  });

  it('falls back through command, pattern, path, and query in order', () => {
    expect(primaryArg(makeToolCall({ input: { command: 'npm test' } }), ROOT)).toBe('npm test');
    expect(primaryArg(makeToolCall({ input: { pattern: 'TODO' } }), ROOT)).toBe('TODO');
    expect(primaryArg(makeToolCall({ input: { path: `${ROOT}/src` } }), ROOT)).toBe('src');
    expect(primaryArg(makeToolCall({ input: { query: 'how to' } }), ROOT)).toBe('how to');
  });

  it('returns an empty string when no known key is present', () => {
    expect(primaryArg(makeToolCall({ input: { unknown: 'x' } }), ROOT)).toBe('');
  });

  it('ignores non-string and blank values', () => {
    expect(primaryArg(makeToolCall({ input: { file_path: 42, command: '   ' } }), ROOT)).toBe('');
  });

  it('flattens newlines in multiline commands', () => {
    const call = makeToolCall({ input: { command: 'a\nb' } });
    expect(primaryArg(call, ROOT)).toBe('a b');
  });

  it('strips the project path out of commands that embed it', () => {
    const call = makeToolCall({ input: { command: `grep -n font ${ROOT}/src/a.ts | head` } });
    expect(primaryArg(call, ROOT)).toBe('grep -n font src/a.ts | head');
  });

  it('replaces the bare project path with "." so no home directory survives', () => {
    expect(primaryArg(makeToolCall({ input: { command: `cd ${ROOT} && npm test` } }), ROOT)).toBe('cd . && npm test');
    expect(primaryArg(makeToolCall({ input: { command: `git -C "${ROOT}" status` } }), ROOT)).toBe('git -C "." status');
    expect(primaryArg(makeToolCall({ input: { command: `ls ${ROOT}` } }), ROOT)).toBe('ls .');
  });

  it('leaves sibling paths that merely share the project path as a prefix', () => {
    const call = makeToolCall({ input: { command: `ls ${ROOT}-two/src` } });
    expect(primaryArg(call, ROOT)).toBe(`ls ${ROOT}-two/src`);
  });

  it('leaves the command alone when the project has no path', () => {
    const call = makeToolCall({ input: { command: 'grep -n font /elsewhere/a.ts' } });
    expect(primaryArg(call, '')).toBe('grep -n font /elsewhere/a.ts');
  });

  it('truncates long arguments', () => {
    const call = makeToolCall({ input: { command: 'x'.repeat(200) } });
    expect(primaryArg(call, ROOT)).toBe(`${'x'.repeat(120)}…`);
  });

  it('shows which skill a Skill call loaded', () => {
    const call = makeToolCall({ name: 'Skill', input: { skill: 'superpowers:tdd' } });
    expect(primaryArg(call, ROOT)).toBe('superpowers:tdd');
  });
});

describe('sessionFiles', () => {
  it('merges created and modified files, deduped and project-relative', () => {
    const session = makeSession({
      filesCreated: [`${ROOT}/src/new.ts`],
      filesModified: [`${ROOT}/src/new.ts`, `${ROOT}/src/old.ts`],
    });
    expect(sessionFiles(session, ROOT)).toEqual(['src/new.ts', 'src/old.ts']);
  });
});

describe('renderTranscript', () => {
  it('writes frontmatter with id, date, model, summary, and files', () => {
    const session = makeSession({
      id: 'abc123',
      startTime: Date.parse('2026-08-06T09:30:00.000Z'),
      model: 'claude-opus-5',
      sessionSummary: 'Fix: the bug',
      filesModified: [`${ROOT}/src/a.ts`],
      filesCreated: [],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).toContain('session: abc123');
    expect(md).toContain('date: 2026-08-06T09:30:00.000Z');
    expect(md).toContain('model: claude-opus-5');
    expect(md).toContain('summary: "Fix: the bug"');
    expect(md).toContain('files: "src/a.ts"');
  });

  it('omits optional frontmatter keys when absent', () => {
    const session = makeSession({ model: null, sessionSummary: null, filesModified: [], filesCreated: [] });
    const md = renderTranscript(session, ROOT);
    expect(md).not.toContain('model:');
    expect(md).not.toContain('summary:');
    expect(md).not.toContain('files:');
  });

  it('labels user and assistant turns', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: 'Do the thing' }),
        makeTurn({ role: 'assistant', content: 'Did it' }),
      ],
    });
    const md = renderTranscript(session, ROOT);
    expect(md).toContain('## You\n\nDo the thing');
    expect(md).toContain('## Claude\n\nDid it');
  });

  it('drops thinking blocks', () => {
    const session = makeSession({
      turns: [makeTurn({ role: 'assistant', content: 'Answer', thinking: 'SECRET REASONING' })],
    });
    expect(renderTranscript(session, ROOT)).not.toContain('SECRET REASONING');
  });

  it('renders tool calls as one line and omits their output entirely', () => {
    const session = makeSession({
      turns: [
        makeTurn({
          role: 'assistant',
          content: 'Working',
          toolCalls: [makeToolCall({ name: 'Read', input: { file_path: `${ROOT}/src/a.ts` }, output: 'HUGE OUTPUT' })],
        }),
      ],
    });
    const md = renderTranscript(session, ROOT);
    expect(md).toContain('`Read` src/a.ts');
    expect(md).not.toContain('HUGE OUTPUT');
  });

  it('renders a bare tool name when there is no usable argument', () => {
    const session = makeSession({
      turns: [makeTurn({ role: 'assistant', content: 'x', toolCalls: [makeToolCall({ name: 'TodoWrite', input: {} })] })],
    });
    expect(renderTranscript(session, ROOT)).toContain('`TodoWrite`');
  });

  it('skips turns with neither content nor tool calls', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: '   ', toolCalls: [] }),
        makeTurn({ role: 'user', content: 'Real prompt' }),
      ],
    });
    expect(renderTranscript(session, ROOT).match(/## You/g)).toHaveLength(1);
  });

  it('notes when a session has no renderable content', () => {
    const session = makeSession({ turns: [] });
    expect(renderTranscript(session, ROOT)).toContain('_No conversation content recorded for this session._');
  });
});

describe('renderTranscript — system-injected user turns', () => {
  it('drops skill instructions without splitting the reply around them', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: 'Fix the bug' }),
        makeTurn({ role: 'assistant', content: 'Loading a skill.' }),
        makeTurn({ role: 'user', content: 'Base directory for this skill: /x/skills/tdd\n\n# TDD\nSKILL BODY' }),
        makeTurn({ role: 'assistant', content: 'Fixed.' }),
      ],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).not.toContain('SKILL BODY');
    expect(md).not.toContain('Base directory for this skill');
    expect(md.match(/## You/g)).toHaveLength(1);
    expect(md).toContain('## Claude\n\nLoading a skill.\n\nFixed.');
  });

  it('renders a slash command as the user typed it', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: '<command-name>/commit</command-name>\n<command-args>fix tests</command-args>' }),
        makeTurn({ role: 'user', content: '<command-name>/clear</command-name>\n<command-args></command-args>' }),
      ],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).toContain('## You\n\n/commit fix tests\n\n/clear');
    expect(md).not.toContain('<command-');
  });

  it('drops local command output, as it does tool output', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: '<local-command-stdout>Total cost: $1.20</local-command-stdout>' }),
        makeTurn({ role: 'user', content: 'Real prompt' }),
      ],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).not.toContain('Total cost');
    expect(md).toContain('## You\n\nReal prompt');
  });

  it('drops turns Claude Code marked as meta, such as expanded command templates', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: '<command-name>/code-review</command-name>\n<command-args></command-args>' }),
        makeTurn({ role: 'user', content: 'You are a senior staff engineer. EXPANDED TEMPLATE', isMeta: true }),
        makeTurn({ role: 'assistant', content: 'Reviewing.' }),
      ],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).not.toContain('EXPANDED TEMPLATE');
    expect(md).toContain('## You\n\n/code-review\n\n## Claude\n\nReviewing.');
  });

  it('drops caveat-only turns', () => {
    const session = makeSession({
      turns: [
        makeTurn({ role: 'user', content: '<local-command-caveat>Caveat: generated by a local command.</local-command-caveat>' }),
      ],
    });
    const md = renderTranscript(session, ROOT);

    expect(md).not.toContain('Caveat');
    expect(md).toContain('_No conversation content recorded for this session._');
  });
});
