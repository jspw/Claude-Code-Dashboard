import React from 'react';
import { MarkdownView } from '../MarkdownView';
import { SystemEvent } from './systemEvents';
import { CONTENT_RENDER_CAP } from './shared';

// Skill instructions injected as a "user" turn — rendered as collapsed context.
export function SkillContextRow({ event }: { event: Extract<SystemEvent, { kind: 'skill' }> }) {
  const [expanded, setExpanded] = React.useState(false);
  const body = event.body;
  const shown = body.length > CONTENT_RENDER_CAP ? body.slice(0, CONTENT_RENDER_CAP) : body;
  const hidden = body.length - shown.length;
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden opacity-80">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors text-left"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 opacity-60" aria-hidden="true">
          <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75V1.75zm8.755 3a2.25 2.25 0 012.25-2.25H14.5v9h-3.757c-.71 0-1.4.201-1.992.572l.004-7.322zm-1.504 7.324l.004-5.073-.002-2.253A2.25 2.25 0 005.003 2.5H1.5v9h3.757a3.75 3.75 0 011.994.574z" />
        </svg>
        <span className="text-[11px] uppercase tracking-wider opacity-50 font-semibold">Skill loaded</span>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] truncate max-w-[200px]">{event.name}</span>
        <span className="ml-auto text-xs opacity-40 shrink-0">{expanded ? 'Hide' : 'Show'} context</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={`shrink-0 opacity-40 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M8 11L3 6l1.06-1.06L8 8.88l3.94-3.94L13 6z" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-[var(--vscode-panel-border)]">
          <MarkdownView content={shown} compact />
          {hidden > 0 && (
            <div className="text-xs opacity-40 mt-1">
              {hidden.toLocaleString()} more chars hidden — open the session file to see the full skill.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
