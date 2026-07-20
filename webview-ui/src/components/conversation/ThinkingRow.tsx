import React from 'react';
import { MarkdownView } from '../MarkdownView';

// Collapsed "Thought" row, like the extension's "Thought for Ns" — the JSONL
// doesn't record thinking duration, so the label stays plain.
export function ThinkingRow({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        title={expanded ? 'Hide thinking' : 'Show thinking'}
        className="flex items-center gap-1.5 text-sm opacity-40 hover:opacity-70 transition-opacity"
      >
        Thought
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M8 11L3 6l1.06-1.06L8 8.88l3.94-3.94L13 6z" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1 text-xs opacity-50 italic">
          <MarkdownView content={thinking} compact />
        </div>
      )}
    </div>
  );
}
