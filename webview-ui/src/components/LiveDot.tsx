import React from 'react';
import { LiveStatus } from '../types';

/** A short word for what a live session is doing; null when Claude Code didn't say. */
export function liveLabel(status: LiveStatus | null | undefined): string | null {
  if (status === 'busy') return 'working';
  if (status === 'waiting') return 'needs you';
  if (status === 'idle') return 'idle';
  return null;
}

export function liveDescription(status: LiveStatus | null | undefined, waitingFor?: string | null): string {
  if (status === 'busy') return 'Claude is working';
  if (status === 'waiting') return waitingFor ? `Waiting on you: ${waitingFor}` : 'Waiting on you';
  if (status === 'idle') return 'Open, waiting for your next prompt';
  return 'Running now';
}

/**
 * Pulses while Claude works (green) or waits on you (yellow); sits still while
 * the session is open but idle. Size comes from `className`.
 */
export default function LiveDot({ status, waitingFor, className = 'w-1.5 h-1.5' }: {
  status?: LiveStatus | null;
  waitingFor?: string | null;
  className?: string;
}) {
  const look = status === 'waiting'
    ? 'bg-yellow-400 animate-pulse'
    : status === 'idle'
    ? 'bg-green-400 opacity-50'
    : 'bg-green-400 animate-pulse';
  const description = liveDescription(status, waitingFor);
  return <span role="img" aria-label={description} title={description} className={`${className} rounded-full shrink-0 ${look}`} />;
}
