import React from 'react';
import { Session, Turn } from '../types';
import { formatTokens, formatCost, formatDuration } from '../utils/format';
import { isPromptTurn } from './conversation/ConversationTurn';
import { UserMessageCard } from './conversation/UserMessageCard';
import { ResponseGroup } from './conversation/ResponseGroup';

// Re-exported for existing importers (SessionsBrowser, ProjectDetail, tests).
export { parseSystemContent, stripAnsi } from './conversation/systemEvents';

export function modelLabel(model: string | null): string | null {
  if (!model) return null;
  if (model.includes('fable')) return 'Fable';
  if (model.includes('mythos')) return 'Mythos';
  if (model.includes('opus')) return 'Opus';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('sonnet')) return 'Sonnet';
  return null;
}

export function modelBadgeColor(model: string | null): string {
  if (!model) return '';
  if (model.includes('fable') || model.includes('mythos')) return 'text-pink-400 bg-pink-500/15';
  if (model.includes('opus')) return 'text-purple-400 bg-purple-500/15';
  if (model.includes('haiku')) return 'text-orange-400 bg-orange-500/15';
  return 'text-blue-400 bg-blue-500/15';
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

function ResumeButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = React.useState(false);
  const command = `claude --resume ${sessionId}`;
  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? 'Copied!' : `Copy: ${command}`}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2a6 6 0 105.2 3H11a.75.75 0 010-1.5h3.25A.75.75 0 0115 4.25V7.5a.75.75 0 01-1.5 0V6.06A7.5 7.5 0 108 .5a.75.75 0 010 1.5z" /></svg>
      )}
      {copied ? 'Copied resume command' : 'Copy resume command'}
    </button>
  );
}

function SessionMetaRow({ session }: { session: Session }) {
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
      {modelLabel(session.model) && (
        <span
          title={session.model ?? undefined}
          className={`font-semibold px-1.5 py-0.5 rounded opacity-100 ${modelBadgeColor(session.model)}`}
        >
          {modelLabel(session.model)}
        </span>
      )}
      <span>·</span>
      <span>{formatDuration(session.durationMs)}</span>
      <span>·</span>
      <span title={`input: ${session.inputTokens?.toLocaleString()} · cache write: ${session.cacheCreationTokens?.toLocaleString()} · cache read: ${session.cacheReadTokens?.toLocaleString()} · output: ${session.outputTokens?.toLocaleString()}`}>
        {formatTokens(session.totalTokens)} tokens
      </span>
      <span>·</span>
      <span
        title={session.pricingConfidence === 'fallback'
          ? 'Model unknown or not in the pricing table — estimated at Sonnet rates'
          : 'Estimated from local token usage, detected model, and static pricing data'}
      >
        est.{session.pricingConfidence === 'fallback' ? '*' : ''} {formatCost(totalCost)}
      </span>
      {(session.cacheReadTokens ?? 0) > 0 && (
        <span className="opacity-50" title="Cache reads are billed at 0.1x and excluded from token count">
          +{formatTokens(session.cacheReadTokens)} cached
        </span>
      )}
      {(session.cacheHitRate ?? 0) > 0 && (
        <span className="text-green-400 opacity-80" title="Cache hit rate: fraction of input served from cache">
          {Math.round(session.cacheHitRate)}% cache
        </span>
      )}
      {session.hasThinking && (
        <span className="inline-flex items-center gap-1 text-yellow-400" title={`Extended thinking: ${formatTokens(session.thinkingTokens ?? 0)} thinking tokens`}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l1.68 4.32L14 7l-4.32 1.68L8 13 6.32 8.68 2 7l4.32-1.68L8 1z" /></svg>
          thinking{(session.thinkingTokens ?? 0) > 0 ? ` (${formatTokens(session.thinkingTokens)})` : ''}
        </span>
      )}
      {(session.subagentCostUsd ?? 0) > 0 && (
        <span className="text-blue-400" title="Subagent sessions cost">
          +{formatCost(session.subagentCostUsd)} subagents
        </span>
      )}
    </div>
  );
}

function FilesTouched({ session }: { session: Session }) {
  return (
    <div>
      <div className="text-xs opacity-50 mb-1">Files touched</div>
      <div className="flex flex-wrap gap-1">
        {session.filesModified.map(f => {
          const created = session.filesCreated?.includes(f);
          return (
            <span
              key={f}
              title={`${created ? 'Created' : 'Edited'}: ${f}`}
              className="inline-flex items-center gap-1 text-xs bg-[var(--vscode-editor-inactiveSelectionBackground)] text-[var(--vscode-editor-foreground)] px-2 py-0.5 rounded font-mono truncate max-w-[200px] opacity-90"
            >
              <span className={created ? 'text-green-400' : 'text-yellow-400'} aria-hidden="true">
                {created ? (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" /></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1.5l3 3-8 8-3.5.5.5-3.5 8-8zm-9 11h11v1.5h-11z" /></svg>
                )}
              </span>
              {f.split('/').pop()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Everything between two user prompts renders as one ResponseGroup so the
// timeline connector line runs unbroken across the whole response — tool
// calls, thoughts, text, and system rows alike.
function conversationBlocks(turns: Turn[], projectRoot: string | null): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  let group: Turn[] = [];
  const flush = () => {
    if (group.length > 0) {
      blocks.push(<ResponseGroup key={group[0].id} turns={group} projectRoot={projectRoot} />);
      group = [];
    }
  };
  for (const turn of turns) {
    if (isPromptTurn(turn)) {
      flush();
      blocks.push(<UserMessageCard key={turn.id} turn={turn} />);
    } else {
      group.push(turn);
    }
  }
  flush();
  return blocks;
}

export default function SessionDetail({ session, turns, loading }: { session: Session; turns: Turn[]; loading: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ResumeButton sessionId={session.id} />
      </div>
      <SessionMetaRow session={session} />
      {session.filesModified.length > 0 && <FilesTouched session={session} />}

      {loading ? (
        <div className="text-xs opacity-40 text-center py-8">Loading turns...</div>
      ) : turns.length === 0 ? (
        <div className="text-xs opacity-40 text-center py-8">No turns recorded for this session.</div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {conversationBlocks(turns, session.cwd)}
        </div>
      )}
    </div>
  );
}
