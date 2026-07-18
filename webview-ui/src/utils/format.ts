/** Keep in sync with PRICING_TABLE_DATE in src/parsers/SessionParser.ts */
export const PRICING_TABLE_DATE = '2026-06';

export const COST_DISCLAIMER =
  `Token usage comes from local Claude session logs. Costs are estimated from detected model pricing (table updated ${PRICING_TABLE_DATE}) and may differ from Anthropic's actual billing.`;

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * The one way cost renders anywhere in the UI:
 *   >= $1     → "$4.32"
 *   $0.01–$1  → "$0.043"
 *   0 < x < $0.01 → "<$0.01"
 *   0 (or negative) → "$0.00"
 */
export function formatCost(usd: number): string {
  if (!usd || usd <= 0) return '$0.00';
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return '<$0.01';
}

/** Average with one decimal place, e.g. "12.5" */
export function formatAvg(n: number): string {
  return n.toFixed(1);
}

export function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
