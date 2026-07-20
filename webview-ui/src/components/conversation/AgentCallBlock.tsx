import React from 'react';
import { ToolCall } from '../../types';
import { MarkdownView } from '../MarkdownView';
import { CopyButton } from './shared';

export function AgentCallBlock({ tc }: { tc: ToolCall }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const prompt = (tc.input?.prompt as string | undefined)?.trim() ?? '';
  return (
    <div className="rounded-lg overflow-hidden text-sm border border-cyan-500/30 bg-[var(--vscode-editor-background)]">
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 opacity-80">Agent</span>
        <span className="text-xs bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded font-mono">subagent</span>
        <div className="ml-auto flex items-center gap-2">
          {prompt && <CopyButton text={prompt} />}
          <button
            onClick={() => setCollapsed(c => !c)}
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
    </div>
  );
}
