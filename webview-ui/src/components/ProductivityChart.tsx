import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ProductivityHour } from '../types';

interface Props {
  data: ProductivityHour[];
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

export function formatProductivityHour(label?: number): string {
  return label !== undefined ? `${String(label).padStart(2, '0')}:00` : '';
}

export function formatProductivityTick(value: number): string {
  return `${String(value).padStart(2, '0')}h`;
}

export function ProductivityChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: number }) {
  if (!active || !payload || !payload.length) { return null; }
  const hourStr = formatProductivityHour(label);
  return (
    <div style={{
      background: 'var(--vscode-editor-background)',
      border: '1px solid var(--vscode-panel-border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{hourStr}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function ProductivityChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-sm opacity-40 text-center py-8">No productivity data yet.</div>;
  }

  const filtered = data.filter(d => d.sessionCount > 0);
  if (filtered.length === 0) {
    return <div className="text-sm opacity-40 text-center py-8">No session data yet.</div>;
  }

  const chartData = data.map(d => ({
    hour: d.hour,
    'Sessions': d.sessionCount,
    'Avg Tool Calls': d.avgToolCalls,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatProductivityTick}
          interval={2}
        />
        <YAxis
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip content={<ProductivityChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, opacity: 0.7 }} />
        <Bar dataKey="Sessions" fill="#6366f1" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Avg Tool Calls" fill="#f59e0b" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
