import React from 'react';
import { vscode } from '../vscode';

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1l3.5 3.5-1.06 1.06-1.69-1.69V10h-1.5V3.87L5.56 5.56 4.5 4.5 8 1z" />
      <path d="M2 9v5h12V9h-1.5v3.5h-9V9H2z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2 1v10h1.5V2.5H10V1H2z" />
      <path d="M5 4v11h9V4H5zm1.5 1.5h6v8h-6v-8z" />
    </svg>
  );
}

const SCOPES = {
  project: {
    label: 'Share with other agents',
    title: "Generate AGENTS.md so Codex, Cursor, and other agents can read this project's context",
    icon: <ShareIcon />,
  },
  session: {
    label: 'Copy for another agent',
    title: "Copy this conversation to the clipboard, ready to paste into another agent's chat",
    icon: <CopyIcon />,
  },
} as const;

interface Props {
  scope: 'project' | 'session';
  sessionId?: string;
  label?: string;
}

/**
 * Two different handoffs behind one button. Project scope writes an AGENTS.md bundle
 * agents pick up on their own; session scope copies the conversation to the clipboard,
 * because there the other agent already knows the project.
 */
export default function ShareContextButton({ scope, sessionId, label }: Props) {
  const share = () => vscode.postMessage({ type: 'shareContext', scope, sessionId });
  const { label: defaultLabel, title, icon } = SCOPES[scope];

  return (
    <button
      onClick={share}
      title={title}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
    >
      {icon}
      {label ?? defaultLabel}
    </button>
  );
}
