import React from 'react';
import { QuestionAnswer, ToolCall } from '../../types';

interface QuestionOption { label: string; description?: string; }
interface Question { question: string; multiSelect?: boolean; options: QuestionOption[]; }

const REJECTED_PREFIX = "The user doesn't want to proceed";

function readQuestions(input: Record<string, unknown>): Question[] {
  const raw = input?.questions;
  if (!Array.isArray(raw)) { return []; }
  return raw
    .filter((q): q is Question => typeof q?.question === 'string')
    .map(q => ({ ...q, options: Array.isArray(q.options) ? q.options.filter(o => typeof o?.label === 'string') : [] }));
}

// Which options the answer picked, plus any text the user typed instead
// ("Other"). Multi-select answers join labels with ", ", and labels may hold
// commas themselves, so match whole labels instead of splitting.
export function resolveAnswer(question: Question, answer: string): { picked: Set<string>; other: string } {
  if (!question.multiSelect) {
    const isOption = question.options.some(o => o.label === answer);
    return { picked: new Set(isOption ? [answer] : []), other: isOption ? '' : answer.trim() };
  }
  let rest = `, ${answer}, `;
  const picked = new Set<string>();
  for (const { label } of question.options) {
    if (rest.includes(`, ${label}, `)) {
      picked.add(label);
      rest = rest.replace(`, ${label}, `, ', ');
    }
  }
  return { picked, other: rest.replace(/^(, )+|(, )+$/g, '').trim() };
}

function OptionMark({ selected, multi }: { selected: boolean; multi: boolean }) {
  const shape = multi ? 'rounded-sm' : 'rounded-full';
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 w-3.5 h-3.5 shrink-0 border flex items-center justify-center ${shape} ${
        selected ? 'border-[var(--vscode-button-background)] text-[var(--vscode-button-background)]' : 'border-current opacity-40'
      }`}
    >
      {selected && (multi ? (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      ))}
    </span>
  );
}

function OptionRow({ label, description, selected, multi }: {
  label: string;
  description?: string;
  selected: boolean;
  multi: boolean;
}) {
  return (
    <li role={multi ? 'checkbox' : 'radio'} aria-checked={selected} className={`flex items-start gap-2.5 ${selected ? '' : 'opacity-50'}`}>
      <OptionMark selected={selected} multi={multi} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${selected ? 'font-semibold' : ''}`}>{label}</div>
        {description && <div className="text-xs opacity-60 break-words">{description}</div>}
      </div>
    </li>
  );
}

function QuestionItem({ question, answer }: { question: Question; answer?: QuestionAnswer }) {
  const multi = !!question.multiSelect;
  const { picked, other } = answer ? resolveAnswer(question, answer.answer) : { picked: new Set<string>(), other: '' };
  return (
    <div>
      <div className="text-sm font-medium mb-2 break-words">
        {question.question}
        {multi && <span className="ml-1.5 text-xs font-normal opacity-40">pick any</span>}
      </div>
      <ul className="space-y-2">
        {question.options.map(option => (
          <OptionRow key={option.label} label={option.label} description={option.description} selected={picked.has(option.label)} multi={multi} />
        ))}
        {other && <OptionRow label="Other" description={other} selected multi={multi} />}
      </ul>
      <div className="pl-6">
        {answer?.preview && (
          <pre className="mt-2 text-xs font-mono bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)] rounded p-2 overflow-x-auto leading-snug">
            {answer.preview}
          </pre>
        )}
        {answer?.notes && <div className="mt-1.5 text-xs opacity-70 break-words"><span className="opacity-60">Note: </span>{answer.notes}</div>}
      </div>
      {!answer && <div className="mt-1.5 text-xs opacity-40">No answer</div>}
    </div>
  );
}

// AskUserQuestion rendered the way the Claude Code extension shows it: each
// question with its options, the user's picks marked, and any text they typed.
export function QuestionsBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = React.useState(true);
  const questions = readQuestions(tc.input);
  const output = tc.output?.trim() ?? '';
  const status = tc.answers
    ? 'Answered'
    : output.startsWith(REJECTED_PREFIX) ? 'Dismissed' : output ? 'No answers recorded' : 'Waiting for answer';
  const count = `${questions.length} question${questions.length === 1 ? '' : 's'}`;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex flex-col items-start text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-semibold">Questions</span>
        <span className="text-xs opacity-60 flex items-center gap-1">
          {status} · {count}
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={`transition-transform ${open ? '' : 'rotate-180'}`}>
            <path d="M3.22 10.53a.75.75 0 001.06 0L8 6.81l3.72 3.72a.75.75 0 101.06-1.06L8.53 5.22a.75.75 0 00-1.06 0L3.22 9.47a.75.75 0 000 1.06z"/>
          </svg>
        </span>
      </button>
      {open && questions.length > 0 && (
        <div className="mt-2 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3 space-y-4">
          {questions.map((q, i) => (
            <QuestionItem key={i} question={q} answer={tc.answers?.[q.question]} />
          ))}
        </div>
      )}
    </div>
  );
}
