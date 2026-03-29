import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { DailyUsage } from '../types';

interface Props {
  data: DailyUsage[];
}

export function formatUsageTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

interface TooltipPayload {
  value: number;
  payload: DailyUsage;
}

export function createUsageTickFormatter(data: DailyUsage[]): (_: string, index: number) => string {
  const tickEvery = Math.ceil(data.length / 7);
  return (_: string, index: number) => (index % tickEvery === 0 ? data[index]?.date ?? '' : '');
}

export function UsageLineChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{formatUsageTokens(d.tokens)} tokens</div>
      <div style={{ opacity: 0.6 }}>${d.costUsd.toFixed(4)}</div>
    </div>
  );
}

export default function UsageLineChart({ data }: Props) {
  // Show fewer x-axis ticks for readability
  const tickEvery = Math.ceil(data.length / 7);
  const tickFormatter = createUsageTickFormatter(data);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--vscode-panel-border)" opacity={0.4} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatter}
          interval={tickEvery - 1}
        />
        <YAxis
          tick={{ fontSize: 10, opacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatUsageTokens}
          width={44}
        />
        <Tooltip content={<UsageLineChartTooltip />} />
        <Line
          type="monotone"
          dataKey="tokens"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
