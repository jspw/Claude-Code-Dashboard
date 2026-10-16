import { describe, expect, it } from 'vitest';
import { Turn, TurnUsage } from '../../types';
import { buildContextTimeline, summarizeTimeline } from '../contextTimeline';

const MIN = 60_000;

function call(minute: number, usage: Partial<TurnUsage>): Turn {
  return {
    id: `a${minute}`,
    role: 'assistant',
    content: '',
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: [],
    timestamp: minute * MIN,
    usage: { input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 100, costUsd: 0.01, model: 'claude-opus-5', ...usage },
  };
}

const prompt = (minute: number): Turn =>
  ({ id: `u${minute}`, role: 'user', content: 'Q', inputTokens: 0, outputTokens: 0, toolCalls: [], timestamp: minute * MIN });

describe('buildContextTimeline', () => {
  it('makes one point per API call, skipping turns without usage', () => {
    const points = buildContextTimeline([
      prompt(0),
      call(0, { input: 5, cacheWrite: 20_000, cacheRead: 0, costUsd: 0.12 }),
      { ...call(0.5, {}), usage: undefined },   // a later entry of the same response
      call(1, { input: 5, cacheWrite: 1_000, cacheRead: 20_000, output: 300 }),
    ]);

    expect(points.map(p => [p.call, p.context, p.gapMs])).toEqual([[1, 20_005, 0], [2, 21_005, MIN]]);
    expect(points[0]).toMatchObject({ cacheWrite: 20_000, cacheRead: 0, costUsd: 0.12, event: null });
    expect(points[1]).toMatchObject({ output: 300, event: null });
  });

  it('marks a cache miss after an idle gap', () => {
    const points = buildContextTimeline([
      call(0, { cacheWrite: 50_000 }),
      call(1, { cacheRead: 50_000, cacheWrite: 2_000 }),
      call(12, { cacheRead: 0, cacheWrite: 52_000 }),
    ]);

    expect(points.map(p => p.event)).toEqual([null, null, { kind: 'cacheMiss', reason: 'idle' }]);
  });

  it('only calls a miss idle once the gap outlasts the cache the session wrote to', () => {
    // Claude Code's main sessions write the 1-hour cache.
    const points = buildContextTimeline([
      call(0, { cacheWrite: 50_000, cacheWrite1h: 50_000 }),
      call(20, { cacheWrite: 51_000, cacheWrite1h: 51_000 }),
      call(90, { cacheWrite: 52_000, cacheWrite1h: 52_000 }),
    ]);

    expect(points.map(p => p.event)).toEqual([
      null,
      { kind: 'cacheMiss', reason: 'other' },
      { kind: 'cacheMiss', reason: 'idle' },
    ]);
  });

  it('names a model switch, or no reason, when a cache miss comes without idling', () => {
    const points = buildContextTimeline([
      call(0, { cacheWrite: 50_000 }),
      call(1, { cacheWrite: 51_000, model: 'claude-sonnet-5' }),
      call(2, { cacheRead: 25_000, cacheWrite: 27_000, model: 'claude-sonnet-5' }),
    ]);

    expect(points.map(p => p.event)).toEqual([
      null,
      { kind: 'cacheMiss', reason: 'model' },
      { kind: 'cacheMiss', reason: 'other' },
    ]);
  });

  it('marks a compaction where the context drops sharply or Claude Code says so', () => {
    const points = buildContextTimeline([
      call(0, { cacheRead: 150_000 }),
      call(1, { cacheWrite: 30_000 }),
      call(2, { cacheRead: 30_000 }),
      call(3, { cacheRead: 28_000, compacted: true }),
    ]);

    expect(points.map(p => p.event)).toEqual([
      null,
      { kind: 'compaction', from: 150_000 },
      null,
      { kind: 'compaction', from: 30_000 },
    ]);
  });

  it('ignores re-writes and drops in a context too small to matter', () => {
    const points = buildContextTimeline([
      call(0, { cacheWrite: 8_000 }),
      call(10, { cacheWrite: 3_000 }),
    ]);

    expect(points.map(p => p.event)).toEqual([null, null]);
  });
});

describe('summarizeTimeline', () => {
  it('counts the peak, compactions, and cache misses', () => {
    const summary = summarizeTimeline(buildContextTimeline([
      call(0, { cacheWrite: 50_000 }),
      call(10, { cacheWrite: 60_000 }),
      call(11, { cacheWrite: 61_000, model: 'claude-sonnet-5' }),
      call(12, { cacheWrite: 20_000 }),
    ]));

    expect(summary).toEqual({ peakContext: 61_000, compactions: 1, cacheMisses: 2, idleMisses: 1 });
  });
});
