import { describe, expect, it } from 'vitest';
import { shortestUniqueLabels } from '../fileLabels';

describe('shortestUniqueLabels', () => {
  it('uses the bare filename when it is already unique', () => {
    const labels = shortestUniqueLabels(['/repo/src/a.ts', '/repo/src/b.ts']);
    expect(labels.get('/repo/src/a.ts')).toBe('a.ts');
    expect(labels.get('/repo/src/b.ts')).toBe('b.ts');
  });

  it('adds parent folders only to files that share a name', () => {
    const labels = shortestUniqueLabels(['/repo/src/share/index.ts', '/repo/src/parsers/index.ts', '/repo/src/a.ts']);
    expect(labels.get('/repo/src/share/index.ts')).toBe('share/index.ts');
    expect(labels.get('/repo/src/parsers/index.ts')).toBe('parsers/index.ts');
    expect(labels.get('/repo/src/a.ts')).toBe('a.ts');
  });

  it('keeps adding folders until the paths diverge', () => {
    const labels = shortestUniqueLabels(['/x/lib/index.ts', '/y/lib/index.ts']);
    expect(labels.get('/x/lib/index.ts')).toBe('x/lib/index.ts');
    expect(labels.get('/y/lib/index.ts')).toBe('y/lib/index.ts');
  });

  it('settles on the full path when one path ends another', () => {
    const labels = shortestUniqueLabels(['/a/index.ts', '/b/a/index.ts']);
    expect(labels.get('/a/index.ts')).toBe('a/index.ts');
    expect(labels.get('/b/a/index.ts')).toBe('b/a/index.ts');
  });
});
