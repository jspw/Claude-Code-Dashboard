import React from 'react';

// Matches @-tagged file paths in prompts (e.g. @src/index.ts); the lookbehind
// keeps emails (user@host) and mid-word @ from matching.
const MENTION_TOKEN_RE = /(?<![\w.@])@[\w./~-]*[\w/]/;
const INLINE_RE = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/;
const INLINE_WITH_MENTIONS_RE = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|(?<![\w.@])@[\w./~-]*[\w/])/;

function MentionChip({ text }: { text: string }) {
  return (
    <span className="font-mono text-xs px-1 rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] text-[var(--vscode-textLink-foreground)]">
      {text}
    </span>
  );
}

/** Plain one-line text with @file mentions highlighted (no markdown parsing). */
export function MentionText({ text }: { text: string }) {
  const parts = text.split(/((?<![\w.@])@[\w./~-]*[\w/])/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') && MENTION_TOKEN_RE.test(part)
          ? <MentionChip key={i} text={part} />
          : part
      )}
    </>
  );
}

function renderInline(
  text: string,
  onLinkClick?: (href: string) => void,
  highlightMentions = false,
): React.ReactNode[] {
  const parts = text.split(highlightMentions ? INLINE_WITH_MENTIONS_RE : INLINE_RE);
  return parts.map((part, i) => {
    if (!part) {
      return null;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="font-mono text-xs bg-[var(--vscode-editor-inactiveSelectionBackground)] px-1 rounded">{part.slice(1, -1)}</code>;
    }
    if (highlightMentions && part.startsWith('@') && MENTION_TOKEN_RE.test(part)) {
      return <MentionChip key={i} text={part} />;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (onLinkClick) {
        return (
          <button
            key={i}
            type="button"
            onClick={() => onLinkClick(href)}
            className="text-[var(--vscode-textLink-foreground)] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {label}
          </button>
        );
      }
      return (
        <a
          key={i}
          href={href}
          className="text-[var(--vscode-textLink-foreground)] underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {label}
        </a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part as unknown as React.ReactNode;
  }).filter(Boolean);
}

// GFM tables: a pipe row followed by a `|---|:--:|` separator row.
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
type Align = 'left' | 'center' | 'right';

function isTableStart(lines: string[], i: number): boolean {
  // The separator must hold a pipe too, so `text | more` over a `---` rule
  // stays a paragraph and a rule.
  const next = lines[i + 1];
  return lines[i].includes('|') && next !== undefined && next.includes('|') && next.includes('-') && TABLE_SEPARATOR_RE.test(next);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}

function cellAlign(spec: string): Align {
  const left = spec.startsWith(':');
  const right = spec.endsWith(':');
  return left && right ? 'center' : right ? 'right' : 'left';
}

const ALIGN_CLASS: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };

export function MarkdownView({
  content,
  compact = false,
  onLinkClick,
  highlightMentions = false,
}: {
  content: string;
  compact?: boolean;
  onLinkClick?: (href: string) => void;
  highlightMentions?: boolean;
}) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <pre key={key++} className="text-xs font-mono bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)] rounded p-3 overflow-x-auto my-2 leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++; continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { elements.push(<h1 key={key++} className="text-xl font-bold mt-5 mb-2 border-b border-[var(--vscode-panel-border)] pb-1">{renderInline(h1[1], onLinkClick, highlightMentions)}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={key++} className="text-base font-bold mt-4 mb-1.5">{renderInline(h2[1], onLinkClick, highlightMentions)}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={key++} className="text-sm font-semibold mt-3 mb-1 opacity-80">{renderInline(h3[1], onLinkClick, highlightMentions)}</h3>); i++; continue; }

    // Bullet list
    if (line.match(/^[\-\*] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*] /)) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].slice(2), onLinkClick, highlightMentions)}</li>);
        i++;
      }
      elements.push(<ul key={key++} className="list-disc pl-5 my-2 space-y-0.5 text-sm">{items}</ul>);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''), onLinkClick, highlightMentions)}</li>);
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal pl-5 my-2 space-y-0.5 text-sm">{items}</ol>);
      continue;
    }

    // Table — consumes the header and separator rows, so the loop advances.
    if (isTableStart(lines, i)) {
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(cellAlign);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { body.push(splitTableRow(lines[i])); i++; }
      const cellClass = 'px-2.5 py-1.5 border border-[var(--vscode-panel-border)] align-top';
      elements.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--vscode-editor-inactiveSelectionBackground)]">
                {header.map((cell, c) => (
                  <th key={c} className={`${cellClass} font-semibold ${ALIGN_CLASS[aligns[c] ?? 'left']}`}>{renderInline(cell, onLinkClick, highlightMentions)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c} className={`${cellClass} ${ALIGN_CLASS[aligns[c] ?? 'left']}`}>{renderInline(row[c] ?? '', onLinkClick, highlightMentions)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={key++} className="my-3 border-[var(--vscode-panel-border)]" />);
      i++; continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // Paragraph. Every block start was ruled out above, so this line always
    // opens one — taking it unconditionally guarantees the loop advances. (A
    // line like `#3 …` is no heading, yet the join test below rejects any `#`
    // line; collecting nothing once left `i` stuck and froze the webview.)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^[\-\*] /) &&
      !lines[i].match(/^\d+\. /) &&
      !lines[i].match(/^---+$/) &&
      !isTableStart(lines, i)
    ) { paraLines.push(lines[i]); i++; }
    elements.push(<p key={key++} className="text-sm leading-relaxed my-1.5 opacity-90">{renderInline(paraLines.join(' '), onLinkClick, highlightMentions)}</p>);
  }

  return <div className={compact ? '' : 'p-4 max-h-[70vh] overflow-y-auto'}>{elements}</div>;
}

export function CommandBlock({ command }: { command: { name: string; content: string } }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors text-left"
      >
        <span className="text-xs font-mono font-semibold text-[var(--vscode-textLink-foreground)]">/{command.name}</span>
        <span className="text-xs opacity-40 ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--vscode-panel-border)]">
          <MarkdownView content={command.content} />
        </div>
      )}
    </div>
  );
}
