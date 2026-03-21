import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ProjectStats } from '../types';
import { formatTokens } from '../utils/format';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
      <div className="text-xs opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export default function WeeklyStatsTab({ projectStats }: { projectStats?: ProjectStats }) {
  if (!projectStats?.weeklyStats) {
    return <div className="text-sm opacity-40 text-center py-12">No data available.</div>;
  }
  const { sessions, tokens, costUsd, dailyBreakdown } = projectStats.weeklyStats;
  const hasActivity = tokens > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Sessions this week" value={String(sessions)} />
        <StatCard label="Tokens this week" value={formatTokens(tokens)} />
        <StatCard label="Cost this week" value={`$${costUsd.toFixed(3)}`} />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Daily Breakdown</h2>
        {!hasActivity ? (
          <div className="text-sm opacity-40 text-center py-8">No activity in the last 7 days.</div>
        ) : (
          <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--vscode-foreground)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: 4, fontSize: 12 }}
                  formatter={(v: number, name: string) => [name === 'tokens' ? formatTokens(v) : `$${v.toFixed(4)}`, name]}
                />
                <Bar dataKey="tokens" fill="var(--vscode-button-background)" radius={[2, 2, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Day-by-Day</h2>
        <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] divide-y divide-[var(--vscode-panel-border)]">
          {[...dailyBreakdown].reverse().map(day => (
            <div key={day.date} className="flex items-center gap-4 px-4 py-2.5 text-sm">
              <span className="font-medium w-12 shrink-0">{day.date}</span>
              <span className="opacity-60 w-20 shrink-0">{day.sessions} session{day.sessions !== 1 ? 's' : ''}</span>
              <span className="opacity-60 w-20 shrink-0">{formatTokens(day.tokens)} tok</span>
              <span className="opacity-60">${day.costUsd.toFixed(4)}</span>
              {day.tokens > 0 && (
                <div className="flex-1 h-1.5 bg-[var(--vscode-input-background)] rounded overflow-hidden ml-2">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(...dailyBreakdown.map(d => d.tokens)) > 0 ? (day.tokens / Math.max(...dailyBreakdown.map(d => d.tokens))) * 100 : 0}%`,
                      background: 'var(--vscode-button-background)',
                      opacity: 0.6,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
