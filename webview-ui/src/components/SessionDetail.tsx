import React from 'react';
import { Session } from '../types';

interface Props {
  session: Session;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
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

export default function SessionDetail({ session }: Props) {
  const hasActivity = session.durationMs !== null && session.activityRatio !== null;
  const activeRatio = session.activityRatio ?? 0;
  const activePct = Math.min(100, Math.max(0, activeRatio));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-xs opacity-60 flex-wrap">
        <span>{new Date(session.startTime).toLocaleString()}</span>
        <span>·</span>
        <span>{formatDuration(session.durationMs)} total</span>
        <span>·</span>
        <span>${session.costUsd.toFixed(4)}</span>
      </div>

      {hasActivity && (
        <div className="space-y-1">
          <div className="flex gap-3 text-xs opacity-60 flex-wrap">
            <span>Active {formatDuration(session.activeTimeMs ?? null)}</span>
            <span>·</span>
            <span>Idle {formatDuration(session.idleTimeMs ?? null)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-[var(--vscode-panel-border)]">
              <div
                className="h-full rounded-full bg-[var(--vscode-charts-green)]"
                style={{ width: `${activePct}%` }}
              />
            </div>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                activeRatio >= 70
                  ? 'text-green-400'
                  : activeRatio >= 40
                  ? 'text-yellow-400'
                  : 'opacity-50'
              }`}
            >
              {Math.round(activeRatio)}% active
            </span>
          </div>
        </div>
      )}

      {session.filesModified.length > 0 && (
        <div>
          <div className="text-xs opacity-50 mb-1">Files modified</div>
          <div className="flex flex-wrap gap-1">
            {session.filesModified.map(f => (
              <span
                key={f}
                className="text-xs bg-[var(--vscode-badge-background)] px-2 py-0.5 rounded font-mono truncate max-w-[200px]"
                title={f}
              >
                {f.split('/').pop()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs opacity-50">
        {session.promptCount} prompts · {session.toolCallCount} tool calls
      </div>
    </div>
  );
}
