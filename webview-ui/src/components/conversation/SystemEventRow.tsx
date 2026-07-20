import React from 'react';
import { SystemEvent } from './systemEvents';

export function SystemEventRow({ event }: { event: SystemEvent }) {
  if (event.kind === 'command') {
    return (
      <div className="flex items-center gap-1.5 text-xs opacity-40 py-0.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <rect x="1" y="1" width="10" height="10" rx="1.5" />
          <path d="M3.5 4.5 5.5 6 3.5 7.5M6.5 7.5h2" />
        </svg>
        <span className="font-mono">{event.name}</span>
        {event.args && <span className="opacity-60 font-mono">{event.args}</span>}
      </div>
    );
  }
  if (event.kind === 'stdout') {
    return (
      <div className="flex items-center gap-1.5 text-xs opacity-35 py-0.5 font-mono">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M2 6h7M6.5 3.5 9 6l-2.5 2.5" />
        </svg>
        <span>{event.text}</span>
      </div>
    );
  }
  return null;
}
