import React from 'react';
import { Project } from '../types';
import { vscode } from '../vscode';

interface Props {
  project: Project;
}

export function formatProjectCardTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function projectCardTimeAgo(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function ProjectCard({ project }: Props) {
  return (
    <button
      onClick={() => vscode.postMessage({ type: 'openProject', projectId: project.id })}
      className="text-left rounded-lg border border-[var(--vscode-panel-border)] p-4 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        {project.isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
        <span className="font-semibold truncate">{project.name}</span>
        {project.isActive && <span className="ml-auto text-xs text-green-400">live</span>}
      </div>
      <div className="text-xs opacity-60 truncate mb-2">{project.path}</div>
      <div className="flex gap-3 text-xs opacity-50">
        <span>{formatProjectCardTokens(project.totalTokens)} tokens</span>
        <span>{project.sessionCount} sessions</span>
        <span className="ml-auto">{projectCardTimeAgo(project.lastActive)}</span>
      </div>
    </button>
  );
}
