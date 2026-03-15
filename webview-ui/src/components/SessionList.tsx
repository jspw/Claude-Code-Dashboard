import React from 'react';
import { Session } from '../types';

interface Props {
  sessions: Session[];
  selectedId?: string;
  onSelect: (session: Session) => void;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function SessionList({ sessions, selectedId, onSelect }: Props) {
  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="space-y-1">
      {sorted.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`w-full text-left rounded p-3 transition-colors text-sm ${
            selectedId === s.id
              ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
              : 'hover:bg-[var(--vscode-list-hoverBackground)]'
          }`}
        >
          <div className="font-medium">{new Date(s.startTime).toLocaleDateString()}</div>
          <div className="text-xs opacity-60">
            {formatDuration(s.durationMs)} · {formatTokens(s.totalTokens)} tokens · {s.promptCount} prompts
            {s.activityRatio !== null && s.activityRatio !== undefined && (
              <>
                {' · '}
                <span className={
                  s.activityRatio >= 70
                    ? 'text-green-400'
                    : s.activityRatio >= 40
                    ? 'text-yellow-400'
                    : ''
                }>
                  {Math.round(s.activityRatio)}% active
                </span>
              </>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
