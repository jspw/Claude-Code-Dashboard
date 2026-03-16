import React from 'react';
import { vscode } from '../vscode';
import { Project, DashboardStats } from '../types';

function timeAgo(ts: number): string {
  if (!ts) { return 'never'; }
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) { return 'just now'; }
  if (h < 24) { return `${h}h ago`; }
  return `${d}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}k`; }
  return String(n);
}

interface Props { projects: Project[]; stats: DashboardStats; }

export default function Sidebar({ projects, stats }: Props) {
  const unique = Array.from(new Map(projects.map(p => [p.id, p])).values());
  const active = unique.filter(p => p.isActive);
  const recent = unique.filter(p => !p.isActive && Date.now() - p.lastActive < 7 * 86_400_000);
  const rest = unique.filter(p => !p.isActive && Date.now() - p.lastActive >= 7 * 86_400_000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '13px', color: 'var(--vscode-foreground)' }}>

      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        opacity: 0.7, fontSize: '11px',
      }}>
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#4ade80',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          flexShrink: 0,
        }} />
        <span>{stats?.activeSessionCount ?? 0} active &middot; {formatTokens(stats?.tokensTodayTotal ?? 0)} tokens today</span>
      </div>

      {/* Open Dashboard button */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
        <button
          onClick={() => vscode.postMessage({ type: 'openDashboard' })}
          style={{
            width: '100%', fontSize: '12px', padding: '4px 10px',
            borderRadius: '2px', cursor: 'pointer',
            background: 'var(--vscode-button-secondaryBackground, var(--vscode-input-background))',
            color: 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
            border: '1px solid var(--vscode-button-border, var(--vscode-input-border, transparent))',
            fontFamily: 'var(--vscode-font-family)',
            fontWeight: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground))')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--vscode-button-secondaryBackground, var(--vscode-input-background))')}
        >
          <span style={{ fontSize: '13px' }}>⊞</span>
          View Dashboard
        </button>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Section label="Active" count={active.length} accent="#4ade80" show={active.length > 0}>
          {active.map(p => <ProjectRow key={p.id} project={p} />)}
        </Section>
        <Section label="Recent" count={recent.length} accent="var(--vscode-textLink-foreground)" show={recent.length > 0}>
          {recent.map(p => <ProjectRow key={p.id} project={p} />)}
        </Section>
        <Section label="Older" count={rest.length} accent="var(--vscode-descriptionForeground)" show={rest.length > 0}>
          {rest.map(p => <ProjectRow key={p.id} project={p} />)}
        </Section>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function Section({ label, count, accent, show, children }: {
  label: string; count: number; accent: string; show: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);
  if (!show) { return null; }
  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '4px 8px',
          fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: accent,
          background: hovered
            ? 'var(--vscode-list-hoverBackground)'
            : 'var(--vscode-sideBarSectionHeader-background, transparent)',
          borderTop: '1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border))',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
      >
        <span style={{
          marginRight: '4px', fontSize: '9px', opacity: 0.7,
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block', transition: 'transform 0.15s',
        }}>▶</span>
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ opacity: 0.45, fontWeight: 400, fontSize: '11px' }}>{count}</span>
      </div>
      {open && children}
    </div>
  );
}

function ProjectRow({ project: p }: { project: Project }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={() => vscode.postMessage({ type: 'openProject', projectId: p.id })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 12px',
        cursor: 'pointer',
        background: hovered ? 'var(--vscode-list-hoverBackground)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {p.isActive ? (
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#4ade80', flexShrink: 0,
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
      ) : (
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          border: '1px solid currentColor', opacity: 0.3, flexShrink: 0,
        }} />
      )}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.name}
      </span>
      <span style={{ fontSize: '11px', opacity: 0.4, flexShrink: 0 }}>
        {p.isActive ? 'live' : timeAgo(p.lastActive)}
      </span>
    </div>
  );
}
