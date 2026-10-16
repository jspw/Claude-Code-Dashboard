import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Turn } from '../types';
import { formatCost, formatDuration, formatTokens } from '../utils/format';
import { buildContextTimeline, summarizeTimeline, TimelinePoint } from '../utils/contextTimeline';

const CONTEXT_COLOR = '#6366f1';     // the token series color used across the dashboard
const MISS_COLOR = '#f87171';        // red-400: a miss re-bills the whole context at the cache-write rate
const COMPACTION_COLOR = '#facc15';  // yellow-400
const AXIS_TICK = { fontSize: 10, opacity: 0.6 };
const Y_AXIS_WIDTH = 44;             // same on both charts so their plots line up

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

function eventLabel(p: TimelinePoint): string | null {
  if (!p.event) { return null; }
  if (p.event.kind === 'compaction') {
    return `Compacted: ${formatTokens(p.event.from)} → ${formatTokens(p.context)}`;
  }
  switch (p.event.reason) {
    case 'idle': return `Cache miss after ${formatDuration(p.gapMs)} idle`;
    case 'model': return 'Cache miss: model switched';
    default: return 'Cache miss: the cached prefix changed';
  }
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ContextTimelineTooltip({ active, payload }: { active?: boolean; payload?: { payload: TimelinePoint }[] }) {
  if (!active || !payload?.length) { return null; }
  const p = payload[0].payload;
  const event = eventLabel(p);
  const time = new Date(p.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-2 text-xs space-y-0.5">
      <div className="font-semibold mb-1">{`Call ${p.call} · ${time}`}</div>
      <TooltipRow label="Context" value={formatTokens(p.context)} />
      <div className="opacity-50">{`cache read ${formatTokens(p.cacheRead)} · write ${formatTokens(p.cacheWrite)}`}</div>
      <TooltipRow label="Output" value={formatTokens(p.output)} />
      <TooltipRow label="Cost" value={formatCost(p.costUsd)} />
      {p.gapMs >= 60_000 && p.event?.kind !== 'cacheMiss' && (
        <div className="opacity-50">{`${formatDuration(p.gapMs)} after the previous call`}</div>
      )}
      {event && (
        <div className={`pt-1 ${p.event?.kind === 'compaction' ? 'text-yellow-400' : 'text-red-400'}`}>{event}</div>
      )}
      {p.event?.kind === 'cacheMiss' && (
        <div className="opacity-50">{`re-sent ${formatTokens(p.cacheWrite)} uncached`}</div>
      )}
    </div>
  );
}

// Recharts calls this for every point; only cache misses get a visible marker.
function missDot({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: TimelinePoint; index?: number }) {
  if (payload?.event?.kind !== 'cacheMiss' || cx === undefined || cy === undefined) {
    return <g key={`dot-${index}`} />;
  }
  return (
    <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={MISS_COLOR}
      stroke="var(--vscode-editor-background)" strokeWidth={2} />
  );
}

function compactionLines(points: TimelinePoint[]) {
  return points
    .filter(p => p.event?.kind === 'compaction')
    .map(p => <ReferenceLine key={p.call} x={p.call} stroke={COMPACTION_COLOR} strokeDasharray="4 3" />);
}

function Charts({ points, showMissLegend, showCompactionLegend }: {
  points: TimelinePoint[];
  showMissLegend: boolean;
  showCompactionLegend: boolean;
}) {
  // Links this pair's crosshairs, and no other timeline's.
  const syncId = React.useId();
  return (
    <div className="mt-2 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3 space-y-1">
      <div className="text-xs opacity-50">Context size per call (tokens)</div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points} syncId={syncId} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--vscode-panel-border)" opacity={0.4} vertical={false} />
          <XAxis dataKey="call" hide />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatTokens} width={Y_AXIS_WIDTH} />
          <Tooltip content={<ContextTimelineTooltip />} cursor={{ stroke: 'var(--vscode-editor-foreground)', strokeOpacity: 0.3 }} />
          {compactionLines(points)}
          <Line
            type="linear"
            dataKey="context"
            stroke={CONTEXT_COLOR}
            strokeWidth={2}
            dot={missDot}
            activeDot={{ r: 4, fill: CONTEXT_COLOR }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="text-xs opacity-50">Cost per call</div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={points} syncId={syncId} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="call" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatCost} width={Y_AXIS_WIDTH} />
          {/* The context chart above shows the tooltip for both. */}
          <Tooltip content={() => null} cursor={{ fill: 'var(--vscode-list-hoverBackground)' }} />
          {compactionLines(points)}
          <Bar dataKey="costUsd" radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false}>
            {points.map(p => p.event?.kind === 'cacheMiss'
              ? <Cell key={p.call} fill={MISS_COLOR} />
              : <Cell key={p.call} fill="var(--vscode-editor-foreground)" fillOpacity={0.3} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {(showMissLegend || showCompactionLegend) && (
        <div className="flex gap-3 pt-1 text-xs opacity-60">
          {showMissLegend && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill={MISS_COLOR} /></svg>
              Cache miss
            </span>
          )}
          {showCompactionLegend && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <line x1="6" y1="0" x2="6" y2="12" stroke={COMPACTION_COLOR} strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              Compaction
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** How a session's context grew call by call, what each call cost, and where the cache was lost. */
export default function ContextTimeline({ turns }: { turns: Turn[] }) {
  const [open, setOpen] = React.useState(false);
  const points = React.useMemo(() => buildContextTimeline(turns), [turns]);
  if (points.length < 2) { return null; }
  const { peakContext, compactions, cacheMisses, idleMisses } = summarizeTimeline(points);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="Tokens sent with each API call and what each call cost. A cache miss re-sends the whole context at the cache-write rate. Claude Code's prompt cache expires after an hour unused in the main session, 5 minutes in subagents."
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-left hover:opacity-80 transition-opacity"
      >
        <span className="opacity-50">{`Context · ${plural(points.length, 'API call')}`}</span>
        <span className="opacity-60">{`peak ${formatTokens(peakContext)}`}</span>
        {compactions > 0 && <span className="text-yellow-400">{plural(compactions, 'compaction')}</span>}
        {cacheMisses > 0 && (
          <span className="text-red-400">
            {`${plural(cacheMisses, 'cache miss', 'cache misses')}${idleMisses > 0 ? ` (${idleMisses} after idle)` : ''}`}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={`opacity-60 transition-transform ${open ? '' : 'rotate-180'}`}>
          <path d="M3.22 10.53a.75.75 0 001.06 0L8 6.81l3.72 3.72a.75.75 0 101.06-1.06L8.53 5.22a.75.75 0 00-1.06 0L3.22 9.47a.75.75 0 000 1.06z" />
        </svg>
      </button>
      {open && <Charts points={points} showMissLegend={cacheMisses > 0} showCompactionLegend={compactions > 0} />}
    </div>
  );
}
