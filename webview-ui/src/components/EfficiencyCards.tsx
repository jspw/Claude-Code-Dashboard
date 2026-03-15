import React from 'react';
import { EfficiencyStats } from '../types';

interface Props {
  data: EfficiencyStats;
}

function Card({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
      <div className="text-xs opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">
        {value}
        {unit && <span className="text-sm font-normal opacity-60 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export default function EfficiencyCards({ data }: Props) {
  if (!data) { return null; }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Card
        label="Avg tokens / prompt"
        value={data.avgTokensPerPrompt.toLocaleString()}
      />
      <Card
        label="Avg tool calls / session"
        value={data.avgToolCallsPerSession}
      />
      <Card
        label="Avg session duration"
        value={data.avgSessionDurationMin}
        unit="min"
      />
      <Card
        label="First-turn resolution"
        value={`${data.firstTurnResolutionRate}%`}
      />
      <Card
        label="Avg active rate"
        value={data.avgActiveRatio}
        unit="%"
      />
    </div>
  );
}
