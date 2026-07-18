import React from 'react';
import { HeatmapCell } from '../types';
import { formatTokens } from '../utils/format';

interface Props {
  data: HeatmapCell[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getColor(tokens: number, maxTokens: number): string {
  if (tokens === 0 || maxTokens === 0) return 'rgba(99,102,241,0.05)';
  const intensity = Math.min(tokens / maxTokens, 1);
  // Scale from low opacity to full opacity of indigo
  const alpha = 0.1 + intensity * 0.85;
  return `rgba(99,102,241,${alpha.toFixed(2)})`;
}



export default function HeatmapGrid({ data }: Props) {
  const maxTokens = Math.max(...data.map(d => d.tokens), 1);

  // Build lookup: day -> hour -> tokens
  const lookup: Record<number, Record<number, number>> = {};
  for (const cell of data) {
    if (!lookup[cell.day]) lookup[cell.day] = {};
    lookup[cell.day][cell.hour] = cell.tokens;
  }

  const hourLabels = [0, 6, 12, 18];

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 500 }}>
        {/* Hour labels on top */}
        <div style={{ display: 'flex', marginLeft: 36, marginBottom: 2 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              style={{
                flex: 1,
                fontSize: 9,
                textAlign: 'center',
                opacity: hourLabels.includes(h) ? 0.6 : 0,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows: one per day */}
        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <div style={{ width: 32, fontSize: 10, opacity: 0.6, flexShrink: 0, paddingRight: 4, textAlign: 'right' }}>
              {DAY_LABELS[day]}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const tokens = lookup[day]?.[hour] ?? 0;
              return (
                <div
                  key={hour}
                  title={tokens > 0 ? `${DAY_LABELS[day]} ${hour}:00 — ${formatTokens(tokens)} tokens` : undefined}
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 2,
                    marginLeft: 1,
                    background: getColor(tokens, maxTokens),
                    border: '1px solid rgba(99,102,241,0.1)',
                    cursor: tokens > 0 ? 'default' : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 36 }}>
          <span style={{ fontSize: 10, opacity: 0.5 }}>Less</span>
          {[0.05, 0.25, 0.5, 0.75, 0.95].map(v => (
            <div
              key={v}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                background: `rgba(99,102,241,${(0.1 + v * 0.85).toFixed(2)})`,
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            />
          ))}
          <span style={{ fontSize: 10, opacity: 0.5 }}>More</span>
        </div>
      </div>
    </div>
  );
}
