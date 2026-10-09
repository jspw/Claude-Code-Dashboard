/**
 * The shortest trailing part of each path that tells it apart from the others:
 * `a.ts` alone, but `share/index.ts` beside `parsers/index.ts` — the way VS Code
 * labels same-named editor tabs.
 */
export function shortestUniqueLabels(paths: string[]): Map<string, string> {
  const segments = new Map(paths.map(p => [p, p.split('/').filter(Boolean)]));
  const tail = (p: string, depth: number) => segments.get(p)!.slice(-depth).join('/');

  const labels = new Map<string, string>();
  for (const [p, segs] of segments) {
    let depth = 1;
    while (depth < segs.length && paths.some(other => other !== p && tail(other, depth) === tail(p, depth))) {
      depth += 1;
    }
    labels.set(p, tail(p, depth));
  }
  return labels;
}
