import React from 'react';
import { MarkdownView } from '../MarkdownView';

// Messages default to a short "show less" preview; expanding renders up to the
// hard cap — injected context can be hundreds of KB, which explodes into
// thousands of DOM nodes and freezes the webview.
export const CONTENT_PREVIEW_LIMIT = 300;
export const CONTENT_LONG_THRESHOLD = 400;
export const CONTENT_RENDER_CAP = 40000;

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? 'Copied!' : 'Copy'}
      className={`opacity-30 hover:opacity-70 transition-opacity ${copied ? '!opacity-80' : ''}`}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
        </svg>
      )}
    </button>
  );
}

// One event in the response timeline: a gutter dot + row content, with a
// vertical connector line running down to the next row. `dotColor` marks tool
// rows with their tool color; without it the dot renders muted (thought/text).
export function TimelineRow({ dotColor, last = false, children }: {
  dotColor?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 min-w-0">
      <div className="flex flex-col items-center shrink-0 w-[7px]">
        <span
          className={`w-[7px] h-[7px] rounded-full shrink-0 mt-[7px] ${dotColor ? '' : 'bg-current opacity-25'}`}
          style={dotColor ? { background: dotColor } : undefined}
          aria-hidden="true"
        />
        {!last && <span className="w-px flex-1 mt-[3px] bg-[var(--vscode-panel-border)]" aria-hidden="true" />}
      </div>
      <div className={`flex-1 min-w-0 ${last ? '' : 'pb-3'}`}>{children}</div>
    </div>
  );
}

export function ExpandableMarkdown({ content, highlightMentions = false }: { content: string; highlightMentions?: boolean }) {
  const [showFull, setShowFull] = React.useState(false);
  const isLong = content.length > CONTENT_LONG_THRESHOLD;
  const shown = !isLong
    ? content
    : showFull
      ? content.slice(0, CONTENT_RENDER_CAP)
      : content.slice(0, CONTENT_PREVIEW_LIMIT);
  const cappedHidden = isLong && showFull ? content.length - CONTENT_RENDER_CAP : 0;
  return (
    <>
      <MarkdownView content={shown} compact highlightMentions={highlightMentions} />
      {isLong && (
        <div className="mt-1">
          <button
            onClick={() => setShowFull(v => !v)}
            className="text-xs px-2 py-0.5 rounded border border-[var(--vscode-panel-border)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
          >
            {showFull ? 'Show less' : `Show more (${(content.length - CONTENT_PREVIEW_LIMIT).toLocaleString()} more chars)`}
          </button>
          {cappedHidden > 0 && (
            <span className="ml-2 text-xs opacity-40">
              {cappedHidden.toLocaleString()} more chars hidden — use copy to get the full text
            </span>
          )}
        </div>
      )}
    </>
  );
}
