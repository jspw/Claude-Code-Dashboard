import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="font-mono text-xs bg-[var(--vscode-editor-inactiveSelectionBackground)] px-1 rounded">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part as unknown as React.ReactNode;
  });
}

export function MarkdownView({ content, compact = false }: { content: string; compact?: boolean }) {
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
    if (h1) { elements.push(<h1 key={key++} className="text-xl font-bold mt-5 mb-2 border-b border-[var(--vscode-panel-border)] pb-1">{renderInline(h1[1])}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={key++} className="text-base font-bold mt-4 mb-1.5">{renderInline(h2[1])}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={key++} className="text-sm font-semibold mt-3 mb-1 opacity-80">{renderInline(h3[1])}</h3>); i++; continue; }

    // Bullet list
    if (line.match(/^[\-\*] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*] /)) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={key++} className="list-disc pl-5 my-2 space-y-0.5 text-sm">{items}</ul>);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal pl-5 my-2 space-y-0.5 text-sm">{items}</ol>);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={key++} className="my-3 border-[var(--vscode-panel-border)]" />);
      i++; continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // Paragraph — collect contiguous non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^[\-\*] /) &&
      !lines[i].match(/^\d+\. /) &&
      !lines[i].match(/^---+$/)
    ) { paraLines.push(lines[i]); i++; }
    if (paraLines.length) {
      elements.push(<p key={key++} className="text-sm leading-relaxed my-1.5 opacity-90">{renderInline(paraLines.join(' '))}</p>);
    }
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
