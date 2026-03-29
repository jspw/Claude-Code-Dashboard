import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { PatternCount } from '../types';

interface Props {
  data: PatternCount[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Fix/Bug': '#ef4444',
  'Explain': '#3b82f6',
  'Refactor': '#f59e0b',
  'Feature': '#22c55e',
  'Test': '#8b5cf6',
  'Other': '#6b7280',
};

interface TooltipPayload {
  value: number;
  payload: PatternCount;
}

export function getPatternCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#6366f1';
}

export function PatternChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--vscode-editor-background)',
      border: '1px solid var(--vscode-panel-border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600 }}>{d.category}</div>
      <div>{d.count} prompt{d.count !== 1 ? 's' : ''}</div>
    </div>
  );
}

export default function PatternChart({ data }: Props) {
  const filtered = data.filter(d => d.count > 0);
  if (filtered.length === 0) {
    return <div style={{ fontSize: 13, opacity: 0.4, textAlign: 'center', padding: '32px 0' }}>No prompt data yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={filtered} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, opacity: 0.7 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<PatternChartTooltip />} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {filtered.map((entry, index) => (
            <Cell key={index} fill={getPatternCategoryColor(entry.category)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
