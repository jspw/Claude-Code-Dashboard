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

// Everything between two user prompts rendered as one continuous timeline —
// thought, text, tool, and system-event rows all joined by a single connector
// line, with one aggregate token footer at the end.
export function ResponseGroup({ turns, projectRoot }: { turns: Turn[]; projectRoot?: string | null }) {
  const rows: { key: string; color?: string; node: React.ReactNode }[] = [];
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
        node: sys.kind === 'skill' ? <SkillContextRow event={sys} /> : <SystemEventRow event={sys} />,
      });
      continue;
    }

    totalIn += turn.inputTokens;
    totalOut += turn.outputTokens;
    if (turn.thinking) {
      rows.push({ key: `${turn.id}-thinking`, node: <ThinkingRow thinking={turn.thinking} /> });
    }
    if (content) {
      rows.push({ key: `${turn.id}-text`, node: <AssistantMessageBody content={content} /> });
    }
    for (const tc of turn.toolCalls) {
      rows.push({
        key: tc.id,
        color: toolColor(tc.name),
        node: tc.name === 'Agent'
          ? <AgentCallBlock tc={tc} />
          : <ToolCallRow tc={tc} projectRoot={projectRoot} />,
      });
    }
  }

  if (rows.length === 0) { return null; }

  return (
    <div>
      {rows.map((row, i) => (
        <TimelineRow key={row.key} dotColor={row.color} last={i === rows.length - 1}>
          {row.node}
        </TimelineRow>
      ))}
      {totalOut > 0 && (
        <div className="pl-[19px] pt-1 text-xs opacity-25">{formatTokens(totalIn)}↑ {formatTokens(totalOut)}↓</div>
      )}
    </div>
  );
}
