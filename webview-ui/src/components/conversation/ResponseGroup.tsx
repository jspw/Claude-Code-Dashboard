import React from 'react';
import { Turn } from '../../types';
import { formatTokens } from '../../utils/format';
import { toolColor } from '../../utils/toolColor';
import { CopyButton, ExpandableMarkdown, TimelineRow } from './shared';
import { parseSystemContent } from './systemEvents';
import { SystemEventRow } from './SystemEventRow';
import { SkillContextRow } from './SkillContextRow';
import { ThinkingRow } from './ThinkingRow';
import { ToolCallRow } from './ToolCallRow';
import { AgentCallBlock } from './AgentCallBlock';

function AssistantMessageBody({ content }: { content: string }) {
  return (
    <div className="group relative pr-6 text-sm">
      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={content} />
      </div>
      <ExpandableMarkdown content={content} />
    </div>
  );
}

type RowKind = 'reply' | 'tool' | 'thought' | 'event';

const STEP_WORDS: [Exclude<RowKind, 'reply'>, string][] = [['tool', 'tool call'], ['thought', 'thought'], ['event', 'event']];

// "2 tool calls · 1 thought" — what a folded response did besides replying.
function stepsLabel(kinds: RowKind[]): string {
  return STEP_WORDS
    .map(([kind, word]) => [kinds.filter(k => k === kind).length, word] as const)
    .filter(([count]) => count > 0)
    .map(([count, word]) => `${count} ${word}${count === 1 ? '' : 's'}`)
    .join(' · ');
}

// Everything between two user prompts rendered as one continuous timeline —
// thought, text, tool, and system-event rows all joined by a single connector
// line, with one aggregate token footer at the end. With `repliesOnly`, only
// Claude's text stays; the rest folds into one row that expands this response.
export function ResponseGroup({ turns, projectRoot, repliesOnly = false }: {
  turns: Turn[];
  projectRoot?: string | null;
  repliesOnly?: boolean;
}) {
  const [showSteps, setShowSteps] = React.useState(false);
  const rows: { key: string; kind: RowKind; color?: string; node: React.ReactNode }[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (const turn of turns) {
    const content = turn.content?.trim() ?? '';

    // System-injected "user" turns (slash commands, stdout, skill payloads)
    // ride the same timeline as muted rows.
    if (turn.role === 'user') {
      const sys = content ? parseSystemContent(content) : null;
      if (!sys || sys === 'skip') { continue; }
      rows.push({
        key: turn.id,
        kind: 'event',
        node: sys.kind === 'skill' ? <SkillContextRow event={sys} /> : <SystemEventRow event={sys} />,
      });
      continue;
    }

    totalIn += turn.inputTokens;
    totalOut += turn.outputTokens;
    if (turn.thinking) {
      rows.push({ key: `${turn.id}-thinking`, kind: 'thought', node: <ThinkingRow thinking={turn.thinking} /> });
    }
    if (content) {
      rows.push({ key: `${turn.id}-text`, kind: 'reply', node: <AssistantMessageBody content={content} /> });
    }
    for (const tc of turn.toolCalls) {
      rows.push({
        key: tc.id,
        kind: 'tool',
        color: toolColor(tc.name),
        node: tc.name === 'Agent'
          ? <AgentCallBlock tc={tc} />
          : <ToolCallRow tc={tc} projectRoot={projectRoot} />,
      });
    }
  }

  if (rows.length === 0) { return null; }

  const steps = rows.filter(row => row.kind !== 'reply');
  const folding = repliesOnly && steps.length > 0;
  const shown = folding && !showSteps ? rows.filter(row => row.kind === 'reply') : rows;
  if (folding) {
    shown.unshift({
      key: 'steps-toggle',
      kind: 'event',
      node: (
        <button
          onClick={() => setShowSteps(open => !open)}
          aria-expanded={showSteps}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity"
        >
          {showSteps ? '▼' : '▶'} {stepsLabel(steps.map(row => row.kind))}
        </button>
      ),
    });
  }

  return (
    <div>
      {shown.map((row, i) => (
        <TimelineRow key={row.key} dotColor={row.color} last={i === shown.length - 1}>
          {row.node}
        </TimelineRow>
      ))}
      {totalOut > 0 && (
        <div className="pl-[19px] pt-1 text-xs opacity-25">{formatTokens(totalIn)}↑ {formatTokens(totalOut)}↓</div>
      )}
    </div>
  );
}
