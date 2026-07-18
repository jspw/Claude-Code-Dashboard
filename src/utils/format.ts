/**
 * Backend counterpart of webview-ui/src/utils/format.ts — same formatting
 * standard so the status bar and notifications match the dashboard.
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}k`; }
  return String(n);
}

export function formatCost(usd: number): string {
  if (!usd || usd <= 0) { return '$0.00'; }
  if (usd >= 1) { return `$${usd.toFixed(2)}`; }
  if (usd >= 0.01) { return `$${usd.toFixed(3)}`; }
  return '<$0.01';
}
