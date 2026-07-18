import React from 'react';
import { vscode } from '../vscode';
import { Project, DashboardStats } from '../types';
import { formatTokens, formatCost, timeAgo } from '../utils/format';

// Kept as named exports for backwards compatibility; both delegate to utils/format.
export const sidebarTimeAgo = timeAgo;
export const formatSidebarTokens = formatTokens;

interface Props { projects: Project[]; stats: DashboardStats; selectedProjectId?: string | null; }

export default function Sidebar({ projects, stats, selectedProjectId = null }: Props) {
  const unique = Array.from(new Map(projects.map(p => [p.id, p])).values());
  const active = unique.filter(p => p.isActive);
  const recent = unique.filter(p => !p.isActive && Date.now() - p.lastActive < 7 * 86_400_000);
  const rest = unique.filter(p => !p.isActive && Date.now() - p.lastActive >= 7 * 86_400_000);

  return (
    <div className="flex flex-col h-full text-[13px] text-[var(--vscode-foreground)]">
      {/* Stats bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--vscode-panel-border)] opacity-70 text-[11px]">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
        <span className="truncate">
          {stats?.activeSessionCount ?? 0} active · {formatTokens(stats?.tokensTodayTotal ?? 0)} tokens · est. {formatCost(stats?.costTodayUsd ?? 0)} today
        </span>
      </div>

      {/* Open Dashboard button */}
      <div className="px-3 py-1.5 border-b border-[var(--vscode-panel-border)]">
        <button
          onClick={() => vscode.postMessage({ type: 'openDashboard' })}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[var(--vscode-button-border,transparent)] bg-[var(--vscode-button-secondaryBackground,var(--vscode-input-background))] text-[var(--vscode-button-secondaryForeground,var(--vscode-foreground))] hover:bg-[var(--vscode-button-secondaryHoverBackground,var(--vscode-list-hoverBackground))] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" />
          </svg>
          View Dashboard
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <Section label="Active" count={active.length} accentClass="text-green-400" show={active.length > 0}>
          {active.map(p => <ProjectRow key={p.id} project={p} selected={selectedProjectId === p.id} />)}
        </Section>
        <Section label="Recent" count={recent.length} accentClass="text-[var(--vscode-textLink-foreground)]" show={recent.length > 0}>
          {recent.map(p => <ProjectRow key={p.id} project={p} selected={selectedProjectId === p.id} />)}
        </Section>
        <Section label="Older" count={rest.length} accentClass="opacity-60" show={rest.length > 0}>
          {rest.map(p => <ProjectRow key={p.id} project={p} selected={selectedProjectId === p.id} />)}
        </Section>
      </div>
    </div>
  );
}

function Section({ label, count, accentClass, show, children }: {
  label: string; count: number; accentClass: string; show: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  if (!show) { return null; }
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center w-full px-2 py-1 text-[13px] font-bold uppercase tracking-wide border-t border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors ${accentClass}`}
      >
        <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" className={`mr-1 opacity-70 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
        <span className="flex-1 text-left">{label}</span>
        <span className="opacity-45 font-normal text-[11px]">{count}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ProjectRow({ project: p, selected }: { project: Project; selected: boolean }) {
  return (
    <div
      className={`group flex items-center gap-2 pl-2.5 pr-2 py-1.5 border-l-2 transition-colors ${
        selected
          ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] border-[var(--vscode-textLink-foreground)]'
          : 'border-transparent hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      {p.isActive ? (
        <span className="w-[7px] h-[7px] rounded-full bg-green-400 animate-pulse shrink-0" />
      ) : (
        <span className="w-[7px] h-[7px] rounded-full border border-current opacity-30 shrink-0" />
      )}
      <button
        type="button"
        onClick={() => vscode.postMessage({ type: 'openProject', projectId: p.id })}
        aria-current={selected ? 'page' : undefined}
        className="flex-1 min-w-0 text-left"
      >
        <div className="truncate">{p.name}</div>
        <div className="text-[11px] opacity-45 truncate">
          {p.isActive ? 'live now' : timeAgo(p.lastActive)} · {formatTokens(p.totalTokens)} · {formatCost(p.totalCostUsd)}
        </div>
      </button>
      <button
        type="button"
        onClick={() => vscode.postMessage({ type: 'openFolder', path: p.path })}
        title="Reveal folder"
        aria-label={`Reveal ${p.name} folder`}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M1.75 2A1.75 1.75 0 000 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0016 12.25V5.75A1.75 1.75 0 0014.25 4H7.5L6.2 2.4A1 1 0 005.42 2H1.75z" />
        </svg>
      </button>
    </div>
  );
}
