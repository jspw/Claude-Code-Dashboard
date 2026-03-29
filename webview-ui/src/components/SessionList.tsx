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

function modelLabel(model: string | null): string | null {
  if (!model) return null;
  if (model.includes('opus')) return 'Opus';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('sonnet')) return 'Sonnet';
  return null;
}

function modelBadgeColor(model: string | null): string {
  if (!model) return '';
  if (model.includes('opus')) return 'text-purple-400 bg-purple-500/15';
  if (model.includes('haiku')) return 'text-orange-400 bg-orange-500/15';
  return 'text-blue-400 bg-blue-500/15';
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
          <div className="flex items-center gap-2">
            <span className="font-medium">{new Date(s.startTime).toLocaleDateString()}</span>
            {modelLabel(s.model) && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${modelBadgeColor(s.model)}`}>
                {modelLabel(s.model)}
              </span>
            )}
          </div>
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
