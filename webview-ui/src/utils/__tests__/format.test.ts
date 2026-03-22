import { describe, expect, it, vi } from 'vitest';
import { formatDuration, formatTokens, timeAgo } from '../format';

describe('format utils', () => {
  it('formats token counts', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1200)).toBe('1.2k');
    expect(formatTokens(2_000_000)).toBe('2.0M');
  });

  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(1500)).toBe('1s');
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(3_660_000)).toBe('1h 1m');
  });

  it('formats relative time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    expect(timeAgo(0)).toBe('never');
    expect(timeAgo(Date.now() - 10_000)).toBe('just now');
    expect(timeAgo(Date.now() - 2 * 3_600_000)).toBe('2h ago');
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe('2d ago');
    vi.useRealTimers();
  });
});
