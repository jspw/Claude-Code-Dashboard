import { describe, expect, it, vi } from 'vitest';
import { formatAvg, formatCost, formatDuration, formatTokens, timeAgo, COST_DISCLAIMER, PRICING_TABLE_DATE } from '../format';

describe('format utils', () => {
  it('formats cost with the standard precision tiers', () => {
    expect(formatCost(4.321)).toBe('$4.32');
    expect(formatCost(1)).toBe('$1.00');
    expect(formatCost(0.0432)).toBe('$0.043');
    expect(formatCost(0.01)).toBe('$0.010');
    expect(formatCost(0.0042)).toBe('<$0.01');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(-1)).toBe('$0.00');
  });

  it('formats one-decimal averages', () => {
    expect(formatAvg(12.49)).toBe('12.5');
    expect(formatAvg(3)).toBe('3.0');
  });

  it('embeds the pricing table date in the disclaimer', () => {
    expect(COST_DISCLAIMER).toContain(PRICING_TABLE_DATE);
  });

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
