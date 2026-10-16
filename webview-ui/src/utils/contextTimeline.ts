import { Turn } from '../types';

// A prompt cache expires when it goes unused for its lifetime, so the first call
// after a longer pause re-sends the whole context at the cache-write rate.
// Claude Code's main sessions write the 1-hour cache; subagents the 5-minute one.
export const CACHE_TTL_5M_MS = 5 * 60 * 1000;
export const CACHE_TTL_1H_MS = 60 * 60 * 1000;

// Below these sizes a drop or a re-write is noise: Claude Code's system prompt
// and tool definitions alone run to ~20k tokens.
const MIN_CONTEXT_FOR_COMPACTION = 20_000;
const MIN_CONTEXT_FOR_MISS = 10_000;
// Context only grows between calls unless it was compacted.
const COMPACTION_DROP = 0.6;
// A healthy call reads nearly all of the previous call's context from cache.
const MISS_READ_SHARE = 0.5;

export type TimelineEvent =
  | { kind: 'compaction'; from: number }
  | { kind: 'cacheMiss'; reason: 'idle' | 'model' | 'other' };

export interface TimelinePoint {
  call: number;          // 1-based API call number
  timestamp: number;
  context: number;       // tokens the call sent: fresh input + cache writes + cache reads
  cacheRead: number;
  cacheWrite: number;
  output: number;
  costUsd: number;
  gapMs: number;         // since the previous call; 0 for the first
  event: TimelineEvent | null;
}

export interface TimelineSummary {
  peakContext: number;
  compactions: number;
  cacheMisses: number;
  idleMisses: number;
}

export function buildContextTimeline(turns: Turn[]): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  let prevModel: string | null = null;
  let cacheTtlMs = CACHE_TTL_5M_MS;   // lifetime of the cache the last write went to
  for (const turn of turns) {
    const usage = turn.usage;
    if (!usage) { continue; }
    const prev = points[points.length - 1];
    const context = usage.input + usage.cacheWrite + usage.cacheRead;
    const gapMs = prev ? Math.max(0, turn.timestamp - prev.timestamp) : 0;

    let event: TimelineEvent | null = null;
    if (prev) {
      if (usage.compacted || (prev.context >= MIN_CONTEXT_FOR_COMPACTION && context < prev.context * COMPACTION_DROP)) {
        event = { kind: 'compaction', from: prev.context };
      } else if (prev.context >= MIN_CONTEXT_FOR_MISS && usage.cacheRead < prev.context * MISS_READ_SHARE) {
        const reason = gapMs >= cacheTtlMs ? 'idle' : usage.model !== prevModel ? 'model' : 'other';
        event = { kind: 'cacheMiss', reason };
      }
    }

    points.push({
      call: points.length + 1,
      timestamp: turn.timestamp,
      context,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      output: usage.output,
      costUsd: usage.costUsd,
      gapMs,
      event,
    });
    prevModel = usage.model;
    if (usage.cacheWrite > 0) { cacheTtlMs = usage.cacheWrite1h > 0 ? CACHE_TTL_1H_MS : CACHE_TTL_5M_MS; }
  }
  return points;
}

export function summarizeTimeline(points: TimelinePoint[]): TimelineSummary {
  let peakContext = 0;
  let compactions = 0;
  let cacheMisses = 0;
  let idleMisses = 0;
  for (const p of points) {
    peakContext = Math.max(peakContext, p.context);
    if (p.event?.kind === 'compaction') { compactions++; }
    if (p.event?.kind === 'cacheMiss') {
      cacheMisses++;
      if (p.event.reason === 'idle') { idleMisses++; }
    }
  }
  return { peakContext, compactions, cacheMisses, idleMisses };
}
