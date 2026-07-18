import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SessionRow, PromptSearchResult } from '../types';
import { vscode } from '../vscode';
import { formatTokens, formatCost, formatDuration, timeAgo } from '../utils/format';
import { modelLabel, modelBadgeColor } from './SessionDetail';

type SortKey = 'recent' | 'cost' | 'tokens';
type ModelFilter = 'all' | 'opus' | 'sonnet' | 'haiku' | 'fable';

function ThinkingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-yellow-400 shrink-0" aria-hidden="true">
      <path d="M8 1l1.68 4.32L14 7l-4.32 1.68L8 13 6.32 8.68 2 7l4.32-1.68L8 1z" />
    </svg>
  );
}

function monthStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function SessionsBrowser() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PromptSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState<ModelFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [thisMonthOnly, setThisMonthOnly] = useState(false);

  // Request the cross-project session list once, and refresh on state updates.
  useEffect(() => {
    vscode.postMessage({ type: 'getAllSessions' });
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'allSessions') {
        setRows(msg.sessions ?? []);
      } else if (msg.type === 'promptSearchResults') {
        setSearchResults(msg.results ?? []);
        setSearching(false);
      } else if (msg.type === 'stateUpdate') {
        // sessions may have changed — re-request
        vscode.postMessage({ type: 'getAllSessions' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Debounced backend-served prompt search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      vscode.postMessage({ type: 'searchPrompts', query: q });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const projectNames = useMemo(() => {
    const names = new Set<string>();
    (rows ?? []).forEach(r => names.add(r.projectName));
    return Array.from(names).sort();
  }, [rows]);

  const openSession = useCallback((projectId: string, sessionId: string) => {
    vscode.postMessage({ type: 'openProject', projectId, sessionId });
  }, []);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (projectFilter !== 'all') { list = list.filter(r => r.projectName === projectFilter); }
    if (modelFilter !== 'all') { list = list.filter(r => (r.model ?? '').includes(modelFilter)); }
    if (thisMonthOnly) {
      const ms = monthStart();
      list = list.filter(r => r.startTime >= ms);
    }
    const sorted = [...list];
    if (sort === 'cost') { sorted.sort((a, b) => (b.costUsd + b.subagentCostUsd) - (a.costUsd + a.subagentCostUsd)); }
    else if (sort === 'tokens') { sorted.sort((a, b) => b.totalTokens - a.totalTokens); }
    else { sorted.sort((a, b) => b.startTime - a.startTime); }
    return sorted;
  }, [rows, projectFilter, modelFilter, thisMonthOnly, sort]);

  if (rows === null) {
    return <div className="text-sm opacity-40 text-center py-12">Loading sessions…</div>;
  }

  if (rows.length === 0) {
    return <div className="text-sm opacity-40 text-center py-12">No sessions recorded yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Prompt search */}
      <div className="relative">
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
          className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
          aria-hidden="true"
        >
          <path d="M11.74 10.34a6 6 0 10-1.4 1.4l3.2 3.2a1 1 0 001.42-1.42l-3.22-3.18zM7 11a4 4 0 110-8 4 4 0 010 8z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search every prompt you've sent to Claude…"
          className="w-full text-sm pl-9 pr-3 py-2 rounded-lg bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] focus:outline-none focus:border-[var(--vscode-button-background)]"
        />
      </div>

      {searchResults !== null ? (
        <PromptSearchResults
          results={searchResults}
          query={query}
          searching={searching}
          onOpen={openSession}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="text-xs px-2 py-1.5 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] focus:outline-none"
            >
              <option value="all">All projects</option>
              {projectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value as ModelFilter)}
              className="text-xs px-2 py-1.5 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] focus:outline-none"
            >
              <option value="all">All models</option>
              <option value="fable">Fable</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="text-xs px-2 py-1.5 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] focus:outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="cost">Most expensive</option>
              <option value="tokens">Most tokens</option>
            </select>
            <button
              onClick={() => { setThisMonthOnly(m => !m); if (!thisMonthOnly) { setSort('cost'); } }}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                thisMonthOnly
                  ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                  : 'border-[var(--vscode-panel-border)] opacity-70 hover:opacity-100'
              }`}
            >
              Most expensive this month
            </button>
            <span className="ml-auto text-xs opacity-45">{filtered.length} of {rows.length}</span>
          </div>

          {/* Session rows */}
          <div className="space-y-1">
            {filtered.map(row => (
              <SessionRowItem key={row.id} row={row} onOpen={openSession} />
            ))}
            {filtered.length === 0 && (
              <div className="text-sm opacity-40 text-center py-8">No sessions match these filters.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SessionRowItem({ row, onOpen }: { row: SessionRow; onOpen: (projectId: string, sessionId: string) => void }) {
  const totalCost = row.costUsd + row.subagentCostUsd;
  return (
    <button
      onClick={() => onOpen(row.projectId, row.id)}
      className="w-full text-left rounded-lg border border-transparent px-3 py-2.5 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        {row.isActiveSession && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
        <span className="text-sm truncate flex-1 min-w-0">
          {row.summary || <span className="opacity-40 italic">Untitled session</span>}
        </span>
        {row.hasThinking && <ThinkingIcon />}
        {modelLabel(row.model) && (
          <span title={row.model ?? undefined} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${modelBadgeColor(row.model)}`}>
            {modelLabel(row.model)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs opacity-55">
        <span className="truncate max-w-[140px]">{row.projectName}</span>
        <span>·</span>
        <span>{timeAgo(row.startTime)}</span>
        <span>·</span>
        <span>{formatDuration(row.durationMs)}</span>
        <span>·</span>
        <span>{formatTokens(row.totalTokens)}</span>
        <span className="ml-auto shrink-0">
          {totalCost > 0 ? `est.${row.pricingConfidence === 'fallback' ? '*' : ''} ${formatCost(totalCost)}` : ''}
        </span>
      </div>
    </button>
  );
}

function PromptSearchResults({
  results,
  query,
  searching,
  onOpen,
}: {
  results: PromptSearchResult[];
  query: string;
  searching: boolean;
  onOpen: (projectId: string, sessionId: string) => void;
}) {
  if (searching && results.length === 0) {
    return <div className="text-sm opacity-40 text-center py-8">Searching…</div>;
  }
  if (results.length === 0) {
    return <div className="text-sm opacity-40 text-center py-8">No prompts match &ldquo;{query}&rdquo;.</div>;
  }
  return (
    <div className="space-y-1">
      <div className="text-xs opacity-45 mb-2">{results.length} match{results.length !== 1 ? 'es' : ''} for &ldquo;{query}&rdquo;</div>
      {results.map((r, i) => (
        <button
          key={`${r.sessionId}-${i}`}
          onClick={() => onOpen(r.projectId, r.sessionId)}
          className="w-full text-left rounded-lg border border-transparent px-3 py-2.5 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors"
        >
          <div className="text-sm">
            <HighlightedSnippet text={r.snippet} query={query} />
          </div>
          <div className="text-xs opacity-45 mt-1 truncate">{r.projectName}</div>
        </button>
      ))}
    </div>
  );
}

export function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) { return <>{text}</>; }
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) { return <>{text}</>; }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-inherit rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
