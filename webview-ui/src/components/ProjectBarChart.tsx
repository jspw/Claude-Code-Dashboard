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
import { ProjectUsage } from '../types';

interface Props {
  data: ProjectUsage[];
}

export function formatProjectBarTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const BAR_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6',
  '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#ef4444',
];

interface TooltipPayload {
  value: number;
  payload: ProjectUsage;
}

export function ProjectBarChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
      <div>{formatProjectBarTokens(d.tokens)} tokens</div>
      <div style={{ opacity: 0.6 }}>${d.costUsd.toFixed(4)}</div>
    </div>
  );
}

export default function ProjectBarChart({ data }: Props) {
  const truncated = data.slice(0, 10).map(d => ({
    ...d,
    shortName: d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={truncated}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatProjectBarTokens}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fontSize: 10, opacity: 0.7 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<ProjectBarChartTooltip />} />
        <Bar dataKey="tokens" radius={[0, 3, 3, 0]}>
          {truncated.map((_, index) => (
            <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
