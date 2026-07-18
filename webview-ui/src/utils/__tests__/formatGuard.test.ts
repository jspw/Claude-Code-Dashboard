import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: all user-facing number formatting goes through utils/format.ts.
 * Inline `.toFixed(` in components leads to the inconsistent cost precision
 * this rule exists to prevent ($0.003 vs $0.00 vs $0.0004 on one screen).
 *
 * If you legitimately need `.toFixed(` outside utils/format.ts (e.g. CSS/rgba
 * interpolation), add the file to the allowlist below with a reason.
 */
const ALLOWED: Record<string, number> = {
  // the formatting module itself
  'utils/format.ts': Infinity,
  // rgba() alpha interpolation for heatmap cells — not user-facing numbers
  'components/HeatmapGrid.tsx': 2,
  // chart axis tick formatters (0-decimal token shorthand for narrow axes)
  'components/UsageLineChart.tsx': 2,
  'components/ProjectBarChart.tsx': 2,
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') { continue; }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('formatting guard', () => {
  it('no inline .toFixed( outside utils/format.ts (use formatCost/formatTokens/formatAvg)', () => {
    const srcRoot = path.resolve(__dirname, '..', '..');
    const violations: string[] = [];

    for (const file of walk(srcRoot)) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, '/');
      const count = (fs.readFileSync(file, 'utf-8').match(/\.toFixed\(/g) ?? []).length;
      if (count === 0) { continue; }
      const allowed = ALLOWED[rel] ?? 0;
      if (count > allowed) {
        violations.push(`${rel}: ${count} .toFixed( call(s), ${allowed} allowed`);
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
