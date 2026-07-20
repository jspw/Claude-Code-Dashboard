import React from 'react';
import { ToolCall } from '../../types';
import { toolColor } from '../../utils/toolColor';

export function toolDisplayName(name: string): string {
  if (name.startsWith('mcp__')) { return name.slice(5).replace('__', '/'); }
  // "WebSearch" → "Web Search", matching the extension's labels
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function toolHint(tc: ToolCall): string {
  return (tc.input?.file_path as string | undefined)
    ?? (tc.input?.command as string | undefined)
    ?? (tc.input?.pattern as string | undefined)
    ?? (tc.input?.query as string | undefined)
    ?? (tc.input?.url as string | undefined)
    ?? '';
}

// Paths inside the project read better relative to its root; anything outside
// the project keeps the full path.
export function relativizeHint(hint: string, projectRoot?: string | null): string {
  if (projectRoot && hint.startsWith(projectRoot + '/')) {
    return hint.slice(projectRoot.length + 1);
  }
  return hint;
}

const OUTPUT_PREVIEW_LIMIT = 240;

function ToolOutputBox({ output }: { output: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = output.length > OUTPUT_PREVIEW_LIMIT;
  const shown = expanded || !isLong ? output : output.slice(0, OUTPUT_PREVIEW_LIMIT) + '…';
  return (
    <button
      onClick={() => isLong && setExpanded(e => !e)}
      title={isLong ? (expanded ? 'Collapse output' : 'Show full output') : undefined}
      className={`mt-1.5 w-full text-left rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-2.5 py-2 flex items-start gap-2.5 ${
        isLong ? 'hover:bg-[var(--vscode-list-hoverBackground)] transition-colors' : 'cursor-default'
      }`}
    >
      <span className="text-xs font-mono opacity-40 shrink-0">OUT</span>
      <span className="text-xs font-mono opacity-70 whitespace-pre-wrap break-words min-w-0 flex-1">{shown}</span>
    </button>
  );
}

export function ToolCallRow({ tc, projectRoot }: { tc: ToolCall; projectRoot?: string | null }) {
  const hint = relativizeHint(toolHint(tc), projectRoot);
  const output = tc.output?.trim() ?? '';
  return (
    <div>
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <span
          className="font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded"
          style={{ background: toolColor(tc.name) + '22', color: toolColor(tc.name) }}
        >
          {toolDisplayName(tc.name)}
        </span>
        {hint && <span className="font-mono opacity-50 truncate" title={hint}>{hint}</span>}
      </div>
      {output && <ToolOutputBox output={output} />}
    </div>
  );
}
