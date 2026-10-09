import { describe, it, expect } from 'vitest';
import { buildBundle } from '../buildBundle';
import { makeProject, makeProjectConfig, makeSession } from '../../__tests__/fixtures/sessions';

const project = makeProject({ path: '/home/user/test-project' });
const config = makeProjectConfig();

const day = (iso: string) => Date.parse(iso);

describe('buildBundle', () => {
  it('always emits AGENTS.md at the repo root', () => {
    const files = buildBundle(project, config, []);
    expect(files.map(f => f.relativePath)).toEqual(['AGENTS.md']);
  });

  it('emits one transcript per session under .agent-context/sessions', () => {
    const sessions = [
      makeSession({ sessionSummary: 'First thing', startTime: day('2026-08-05T10:00:00Z') }),
      makeSession({ sessionSummary: 'Second thing', startTime: day('2026-08-06T10:00:00Z') }),
    ];
    const paths = buildBundle(project, config, sessions).map(f => f.relativePath);

    expect(paths).toContain('.agent-context/sessions/2026-08-06-second-thing.md');
    expect(paths).toContain('.agent-context/sessions/2026-08-05-first-thing.md');
  });

  it('orders sessions newest first', () => {
    const sessions = [
      makeSession({ sessionSummary: 'older', startTime: day('2026-08-01T10:00:00Z') }),
      makeSession({ sessionSummary: 'newer', startTime: day('2026-08-09T10:00:00Z') }),
    ];
    const index = buildBundle(project, config, sessions)
      .find(f => f.relativePath === '.agent-context/INDEX.md')!;
    expect(index.content.indexOf('newer')).toBeLessThan(index.content.indexOf('older'));
  });

  it('indexes every transcript it emits', () => {
    const files = buildBundle(project, config, [makeSession(), makeSession()]);
    const index = files.find(f => f.relativePath === '.agent-context/INDEX.md');

    expect(index).toBeDefined();
    for (const transcript of files.filter(f => f.relativePath.startsWith('.agent-context/sessions/'))) {
      expect(index!.content).toContain(transcript.relativePath.split('/').pop());
    }
  });

  it('omits INDEX.md when there are no sessions at all', () => {
    const files = buildBundle(project, config, []);
    expect(files.map(f => f.relativePath)).not.toContain('.agent-context/INDEX.md');
  });

  it('falls back to the session id when the summary is null', () => {
    const session = makeSession({ id: 'deadbeef-1111', sessionSummary: null, startTime: day('2026-08-06T10:00:00Z') });
    const paths = buildBundle(project, config, [session]).map(f => f.relativePath);
    expect(paths).toContain('.agent-context/sessions/2026-08-06-deadbeef.md');
  });

  it('falls back to the session id when the summary slugifies to nothing', () => {
    const session = makeSession({ id: 'cafe0000-2222', sessionSummary: '!!! ???', startTime: day('2026-08-06T10:00:00Z') });
    const paths = buildBundle(project, config, [session]).map(f => f.relativePath);
    expect(paths).toContain('.agent-context/sessions/2026-08-06-cafe0000.md');
  });

  it('suffixes colliding filenames instead of overwriting', () => {
    const sessions = [
      makeSession({ sessionSummary: 'Same day same name', startTime: day('2026-08-06T09:00:00Z') }),
      makeSession({ sessionSummary: 'Same day same name', startTime: day('2026-08-06T11:00:00Z') }),
      makeSession({ sessionSummary: 'Same day same name', startTime: day('2026-08-06T13:00:00Z') }),
    ];
    const transcripts = buildBundle(project, config, sessions)
      .filter(f => f.relativePath.startsWith('.agent-context/sessions/'))
      .map(f => f.relativePath);

    expect(new Set(transcripts).size).toBe(3);
    expect(transcripts).toContain('.agent-context/sessions/2026-08-06-same-day-same-name.md');
    expect(transcripts).toContain('.agent-context/sessions/2026-08-06-same-day-same-name-2.md');
    expect(transcripts).toContain('.agent-context/sessions/2026-08-06-same-day-same-name-3.md');
  });

  it('links index rows to the exact transcript filenames written', () => {
    const sessions = [
      makeSession({ sessionSummary: 'Dup', startTime: day('2026-08-06T09:00:00Z') }),
      makeSession({ sessionSummary: 'Dup', startTime: day('2026-08-06T11:00:00Z') }),
    ];
    const files = buildBundle(project, config, sessions);
    const index = files.find(f => f.relativePath === '.agent-context/INDEX.md')!;

    for (const transcript of files.filter(f => f.relativePath.startsWith('.agent-context/sessions/'))) {
      const name = transcript.relativePath.split('/').pop()!;
      expect(index.content).toContain(`(sessions/${name})`);
    }
  });

  it('reports the session count to AGENTS.md', () => {
    const sessions = [makeSession(), makeSession()];
    const agents = buildBundle(project, config, sessions)[0];
    expect(agents.content).toContain('2 sessions indexed');
  });
});
