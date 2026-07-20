import React from 'react';
import { Turn, TurnAttachment } from '../../types';
import { CopyButton, ExpandableMarkdown } from './shared';

function AttachmentChips({ attachments }: { attachments: TurnAttachment[] }) {
  return (
    <div className="px-3 pb-1.5 flex flex-wrap gap-1.5">
      {attachments.map(a => (
        <span
          key={a.path}
          title={a.path}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] max-w-full min-w-0"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0" aria-hidden="true">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013l-2.914-2.914a.25.25 0 00-.013-.011z" />
          </svg>
          <span className="truncate">{a.displayPath || a.path}</span>
        </span>
      ))}
    </div>
  );
}

// The user's prompt: right-indented card with the accent left border and
// "You" header.
export function UserMessageCard({ turn }: { turn: Turn }) {
  const content = turn.content?.trim() ?? '';
  const attachments = turn.attachments ?? [];
  return (
    <div className="pl-6 sm:pl-10">
      <div className="rounded-lg overflow-hidden text-sm bg-[var(--vscode-input-background)] border-l-2 border-[var(--vscode-button-background)]">
        <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs opacity-50 font-semibold uppercase tracking-wider">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M10.561 8.073a6.005 6.005 0 013.432 5.142.75.75 0 11-1.498.07 4.5 4.5 0 00-8.99 0 .75.75 0 01-1.498-.07 6.004 6.004 0 013.431-5.142 3.999 3.999 0 115.123 0zM10.5 5a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z"/>
            </svg>
            You
          </span>
          {content && (
            <div className="ml-auto">
              <CopyButton text={content} />
            </div>
          )}
        </div>
        {attachments.length > 0 && <AttachmentChips attachments={attachments} />}
        {content && (
          <div className="px-3 pb-2">
            <ExpandableMarkdown content={content} highlightMentions />
          </div>
        )}
      </div>
    </div>
  );
}
