import React from 'react';
import { Session, Turn, ToolCall } from '../types';
import { formatTokens, formatDuration } from '../utils/format';
import { toolColor } from '../utils/toolColor';
import { MarkdownView } from './MarkdownView';

// ── System event parsing ───────────────────────────────────────────────────────

type SystemEvent =
  | { kind: 'command'; name: string; args?: string }
  | { kind: 'stdout'; text: string };

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(s: string): string { return s.replace(ANSI_RE, ''); }

function parseSystemContent(content: string): SystemEvent | 'skip' | null {
  const t = content.trim();
  if (/<local-command-caveat>/i.test(t) && !t.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '').trim()) {
    return 'skip';
  }
  const cmdMatch = t.match(/<command-name>([^<]+)<\/command-name>/);
  if (cmdMatch) {
    const argsMatch = t.match(/<command-args>([\s\S]*?)<\/command-args>/);
    const args = argsMatch?.[1]?.trim() || undefined;
    return { kind: 'command', name: cmdMatch[1].trim(), args };
  }
  const stdoutMatch = t.match(/<(?:local-command-stdout|command-stdout)>([\s\S]*?)<\/(?:local-command-stdout|command-stdout)>/);
  if (stdoutMatch) {
    const text = stripAnsi(stdoutMatch[1].trim());
    return text ? { kind: 'stdout', text } : 'skip';
  }
  return null;
}

function SystemEventRow({ event }: { event: SystemEvent }) {
  if (event.kind === 'command') {
    return (
      <div className="flex items-center gap-1.5 text-xs opacity-40 py-0.5 pl-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <rect x="1" y="1" width="10" height="10" rx="1.5" />
          <path d="M3.5 4.5 5.5 6 3.5 7.5M6.5 7.5h2" />
        </svg>
        <span className="font-mono">{event.name}</span>
        {event.args && <span className="opacity-60 font-mono">{event.args}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs opacity-35 py-0.5 pl-1 font-mono">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M2 6h7M6.5 3.5 9 6l-2.5 2.5" />
      </svg>
      <span>{event.text}</span>
    </div>
  );
}

// ── Turn rendering ─────────────────────────────────────────────────────────────

function TurnToolBadge({ tc }: { tc: ToolCall }) {
  const displayName = tc.name.startsWith('mcp__')
    ? tc.name.slice(5).replace('__', '/')
    : tc.name;
  const hint = (tc.input?.file_path as string | undefined)
    ?? (tc.input?.command as string | undefined)
    ?? (tc.input?.pattern as string | undefined)
    ?? (tc.input?.query as string | undefined)
    ?? '';
  return (
    <div className="flex items-center gap-2 text-xs min-w-0">
      <span
        className="font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded"
        style={{ background: toolColor(tc.name) + '22', color: toolColor(tc.name) }}
      >
        {displayName}
      </span>
      {hint && (
        <span className="opacity-50 truncate font-mono" title={hint}>
          {hint.length > 80 ? hint.slice(0, 80) + '…' : hint}
        </span>
      )}
    </div>
  );
}

function truncateSessionId(id: string): string {
  return id.slice(0, 8);
}

function SessionIdGlyph({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
      </svg>
    );
  }

  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M1 1h4v4H1V1zm1 1v2h2V2H2zm5-1h4v4H7V1zm1 1v2h2V2H8zm5-1h2v2h-2V1zM1 7h4v4H1V7zm1 1v2h2V8H2zm5-1h4v4H7V7zm1 1v2h2V8H8zm5-1h2v2h-2V7zM1 13h2v2H1v-2zm6 0h4v2H7v-2zm6 0h2v2h-2v-2z"/>
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? 'Copied!' : 'Copy'}
      className={`opacity-30 hover:opacity-70 transition-opacity ${copied ? '!opacity-80' : ''}`}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
        </svg>
      )}
    </button>
  );
}

function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand' : 'Collapse'}
      className="opacity-30 hover:opacity-70 transition-opacity"
    >
      {collapsed ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 9.5l-5-5 1.06-1.06L8 7.44l4.94-4 1.06 1.06z"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 6.5l5 5-1.06 1.06L8 8.56l-4.94 4.94L2 12.44z"/>
        </svg>
      )}
    </button>
  );
}

function AgentCallBlock({ tc, tokenInfo }: { tc: ToolCall; tokenInfo?: { input: number; output: number } }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const prompt = (tc.input?.prompt as string | undefined)?.trim() ?? '';
  return (
    <div className="rounded-lg overflow-hidden text-sm border border-cyan-500/30 bg-[var(--vscode-editor-background)]">
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 opacity-80">Agent</span>
        <span className="text-xs bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded font-mono">subagent</span>
        <div className="ml-auto flex items-center gap-2">
          {prompt && <CopyButton text={prompt} />}
          <CollapseButton collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        </div>
      </div>
      {!collapsed && prompt && (
        <div className="px-3 pb-2 border-t border-cyan-500/20">
          <MarkdownView content={prompt} compact />
        </div>
      )}
      {collapsed && prompt && (
        <div className="px-3 pb-2.5 text-xs opacity-40 truncate font-mono">{prompt.slice(0, 120)}{prompt.length > 120 ? '…' : ''}</div>
      )}
      {tokenInfo && tokenInfo.output > 0 && (
        <div className="px-3 pb-2 text-xs opacity-20 text-right">{formatTokens(tokenInfo.input)}↑ {formatTokens(tokenInfo.output)}↓</div>
      )}
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const content = turn.content?.trim() ?? '';
  const hasContent = content.length > 0;
  const hasTools = turn.toolCalls.length > 0;

  if (!hasContent && !hasTools) return null;

  if (turn.role === 'user' && hasContent) {
    const sys = parseSystemContent(content);
    if (sys === 'skip') return null;
    if (sys) return <SystemEventRow event={sys} />;
  }

  // Split tool calls: Agent gets full blocks, others get compact badges
  const agentCalls = turn.toolCalls.filter(tc => tc.name === 'Agent');
  const regularCalls = turn.toolCalls.filter(tc => tc.name !== 'Agent');

  // Tool-only assistant turn
  if (turn.role === 'assistant' && !hasContent && hasTools) {
    const tokenInfo = { input: turn.inputTokens, output: turn.outputTokens };
    return (
      <div className="space-y-2">
        {agentCalls.map(tc => (
          <AgentCallBlock key={tc.id} tc={tc} tokenInfo={agentCalls.length === 1 && regularCalls.length === 0 ? tokenInfo : undefined} />
        ))}
        {regularCalls.length > 0 && (
          <div className="pl-3 border-l-2 border-[var(--vscode-panel-border)] space-y-1.5 py-0.5">
            {regularCalls.map(tc => (
              <TurnToolBadge key={tc.id} tc={tc} />
            ))}
            {turn.outputTokens > 0 && agentCalls.length === 0 && (
              <div className="text-xs opacity-20">{formatTokens(turn.inputTokens)}↑ {formatTokens(turn.outputTokens)}↓</div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isUser = turn.role === 'user';

  return (
    <div className="space-y-2">
      <div className={`rounded-lg overflow-hidden text-sm ${isUser ? 'bg-[var(--vscode-input-background)]' : 'bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]'}`}>
        <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
          <span className="text-xs opacity-40 font-semibold uppercase tracking-wider">
            {isUser ? 'You' : 'Claude'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {hasContent && <CopyButton text={content} />}
            <CollapseButton collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
          </div>
        </div>
        {!collapsed && (
          <>
            {hasContent && (
              <div className="px-3 pb-1">
                <MarkdownView content={content} compact />
              </div>
            )}
            {regularCalls.length > 0 && (
              <div className={`px-3 pb-2.5 space-y-1.5 ${hasContent ? 'border-t border-[var(--vscode-panel-border)] pt-2 mt-1' : 'pt-1'}`}>
                {regularCalls.map(tc => (
                  <TurnToolBadge key={tc.id} tc={tc} />
                ))}
              </div>
            )}
          </>
        )}
        {collapsed && hasContent && (
          <div className="px-3 pb-2.5 text-xs opacity-40 truncate">{content.slice(0, 120)}{content.length > 120 ? '…' : ''}</div>
        )}
        {turn.outputTokens > 0 && (
          <div className="px-3 pb-2 text-xs opacity-25 text-right">{formatTokens(turn.inputTokens)}↑ {formatTokens(turn.outputTokens)}↓</div>
        )}
      </div>
      {agentCalls.map(tc => (
        <AgentCallBlock key={tc.id} tc={tc} />
      ))}
    </div>
  );
}

// ── SessionDetail ──────────────────────────────────────────────────────────────

export default function SessionDetail({ session, turns, loading }: { session: Session; turns: Turn[]; loading: boolean }) {
  const totalCost = session.costUsd + (session.subagentCostUsd ?? 0);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  const copySessionId = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [session.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-60">
        <button
          type="button"
          onClick={() => void copySessionId()}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono transition-all -my-0.5 ${
            copyState === 'copied'
              ? 'bg-green-500/20 !text-green-400 !opacity-100'
              : copyState === 'failed'
              ? 'bg-red-500/20 !text-red-400 !opacity-100'
              : 'bg-[var(--vscode-editor-inactiveSelectionBackground)] hover:!opacity-90'
          }`}
          title={
            copyState === 'copied'
              ? `Copied full ID: ${session.id}`
              : copyState === 'failed'
              ? `Copy failed. Session ID: ${session.id}`
              : `Copy ID: ${session.id}`
          }
          aria-label="Copy session ID"
        >
          <SessionIdGlyph copied={copyState === 'copied'} />
          {copyState === 'copied' ? 'copied' : copyState === 'failed' ? 'failed' : truncateSessionId(session.id)}
        </button>
        <span>·</span>
        <span>{new Date(session.startTime).toLocaleString([], { hour12: true })}</span>
        <span>·</span>
        <span>{formatDuration(session.durationMs)}</span>
        <span>·</span>
        <span title={`input: ${session.inputTokens?.toLocaleString()} · cache write: ${session.cacheCreationTokens?.toLocaleString()} · cache read: ${session.cacheReadTokens?.toLocaleString()} · output: ${session.outputTokens?.toLocaleString()}`}>
          {formatTokens(session.totalTokens)} tokens
        </span>
        <span>·</span>
        <span>${totalCost.toFixed(4)}</span>
        {(session.cacheReadTokens ?? 0) > 0 && (
          <span className="opacity-50" title="Cache reads are billed at 0.1x and excluded from token count">
            +{formatTokens(session.cacheReadTokens)} cached
          </span>
        )}
        {(session.cacheHitRate ?? 0) > 0 && (
          <span className="text-green-400 opacity-80" title="Cache hit rate: fraction of input served from cache">
            {session.cacheHitRate.toFixed(0)}% cache
          </span>
        )}
        {session.hasThinking && (
          <span className="text-yellow-400" title={`Extended thinking: ${formatTokens(session.thinkingTokens ?? 0)} thinking tokens`}>
            ⚡ thinking{(session.thinkingTokens ?? 0) > 0 ? ` (${formatTokens(session.thinkingTokens)})` : ''}
          </span>
        )}
        {(session.subagentCostUsd ?? 0) > 0 && (
          <span className="text-blue-400" title="Subagent sessions cost">
            +${session.subagentCostUsd.toFixed(4)} subagents
          </span>
        )}
      </div>

      {session.filesModified.length > 0 && (
        <div>
          <div className="text-xs opacity-50 mb-1">Files touched</div>
          <div className="flex flex-wrap gap-1">
            {session.filesModified.map(f => (
              <span
                key={f}
                title={f}
                className="text-xs bg-[var(--vscode-editor-inactiveSelectionBackground)] text-[var(--vscode-editor-foreground)] px-2 py-0.5 rounded font-mono truncate max-w-[200px] opacity-90"
              >
                {session.filesCreated?.includes(f) ? '🆕 ' : '✏️ '}
                {f.split('/').pop()}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs opacity-40 text-center py-8">Loading turns...</div>
      ) : turns.length === 0 ? (
        <div className="text-xs opacity-40 text-center py-8">No turns recorded for this session.</div>
      ) : (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {turns.map(turn => (
            <TurnBlock key={turn.id} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
}
