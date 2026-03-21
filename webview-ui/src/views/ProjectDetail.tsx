import React, { useState, useEffect, useCallback } from 'react';
import { Project, Session, Turn, ProjectConfig, McpServer, ProjectStats, ProjectFile, ProjectToolCall } from '../types';
import { vscode } from '../vscode';
import { formatTokens, formatDuration, timeAgo } from '../utils/format';
import { toolColor } from '../utils/toolColor';
import { MarkdownView, CommandBlock } from '../components/MarkdownView';
import SessionDetail from '../components/SessionDetail';
import WeeklyStatsTab from '../components/WeeklyStatsTab';
import ToolUsageBar from '../components/ToolUsageBar';

interface Props {
  project: Project;
  sessions: Session[];
  subagentSessions?: Session[];
  config?: ProjectConfig;
  projectStats?: ProjectStats;
  projectFiles?: ProjectFile[];
}

type Tab = 'sessions' | 'claudemd' | 'tools' | 'mcp' | 'subagents' | 'files' | 'commands' | 'weekly';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'sessions',  label: 'Sessions' },
  { key: 'weekly',    label: 'Weekly' },
  { key: 'claudemd',  label: 'CLAUDE.md' },
  { key: 'commands',  label: 'Commands' },
  { key: 'tools',     label: 'Tools' },
  { key: 'mcp',       label: 'MCP Servers' },
  { key: 'subagents', label: 'Subagents' },
  { key: 'files',     label: 'Files' },
];

export default function ProjectDetail({ project, sessions, subagentSessions, config, projectStats, projectFiles }: Props) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [fileSort, setFileSort] = useState<'edits' | 'recent'>('edits');
  const sorted = [...(sessions ?? [])].sort((a, b) => b.startTime - a.startTime);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'sessionTurns' && msg.sessionId === selectedSession?.id) {
        setTurns(msg.turns ?? []);
        setTurnsLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedSession?.id]);

  const selectSession = useCallback((session: Session) => {
    setSelectedSession(session);
    setTurns([]);
    setTurnsLoading(true);
    vscode.postMessage({ type: 'getSessionTurns', sessionId: session.id });
  }, []);

  if (!project) {
    return <div className="p-6 opacity-50">Project not found.</div>;
  }

  const sortedFiles = [...(projectFiles ?? [])].sort((a, b) =>
    fileSort === 'recent' ? b.lastTouched - a.lastTouched : b.editCount - a.editCount
  );

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          {project.isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.isActive && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">live</span>}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => vscode.postMessage({ type: 'exportSessions', format: 'json' })}
              className="text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => vscode.postMessage({ type: 'exportSessions', format: 'csv' })}
              className="text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
        <p className="text-xs opacity-50">{project.path}</p>
        <div className="flex gap-2 mt-2">
          {project.techStack?.map(t => (
            <span key={t} className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total tokens" value={formatTokens(project.totalTokens)} />
        <StatCard label="Estimated cost" value={`$${project.totalCostUsd.toFixed(3)}`} />
        <StatCard label="Sessions" value={String(project.sessionCount)} />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-[var(--vscode-panel-border)]">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-[var(--vscode-button-background)] text-[var(--vscode-button-background)]'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Sessions tab ── */}
      {activeTab === 'sessions' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
          <section className="min-w-0 overflow-hidden">
            <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Sessions</h2>
            <div className="space-y-1 overflow-y-auto max-h-[70vh]">
              {sorted.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s)}
                  className={`w-full text-left rounded p-3 transition-colors text-sm ${
                    selectedSession?.id === s.id
                      ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                      : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {s.isActiveSession && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
                    <span className="font-medium truncate">{new Date(s.startTime).toLocaleDateString()}</span>
                    {s.hasThinking && <span title="Used extended thinking" className="text-yellow-400 text-xs shrink-0">⚡</span>}
                    <span className="text-xs opacity-40 ml-auto shrink-0">{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                  <div className="text-xs opacity-60 mt-0.5 truncate">
                    {formatDuration(s.durationMs)} · {formatTokens(s.totalTokens)} · {s.promptCount}p
                    {(s.subagentCostUsd ?? 0) > 0 && <span className="ml-1 text-blue-400">+sub</span>}
                  </div>
                  {s.sessionSummary && (
                    <div className="text-xs opacity-50 mt-1 truncate italic">{s.sessionSummary}</div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden">
            {selectedSession ? (
              <SessionDetail key={selectedSession.id} session={selectedSession} turns={turns} loading={turnsLoading} />
            ) : (
              <div className="opacity-40 text-sm mt-8 text-center">Select a session to view details</div>
            )}
          </section>
        </div>
      )}

      {/* ── Subagents tab ── */}
      {activeTab === 'subagents' && (
        <div className="space-y-3">
          {(!subagentSessions || subagentSessions.length === 0) ? (
            <div className="text-sm opacity-40 text-center py-12">No subagent sessions found for this project.<br /><span className="opacity-60 text-xs">Subagents are spawned when Claude uses the Task or Agent tool.</span></div>
          ) : (
            <>
              <p className="text-xs opacity-50">{subagentSessions.length} subagent session{subagentSessions.length !== 1 ? 's' : ''} spawned by this project</p>
              <div className="space-y-2">
                {[...subagentSessions].sort((a, b) => b.startTime - a.startTime).map(s => (
                  <SubagentRow key={s.id} session={s} parentSessions={sessions} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Files tab ── */}
      {activeTab === 'files' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-60">{sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''} touched across all sessions</span>
            <div className="ml-auto flex rounded overflow-hidden border border-[var(--vscode-panel-border)] text-xs">
              <button
                onClick={() => setFileSort('edits')}
                className={`px-3 py-1 transition-colors ${fileSort === 'edits' ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'opacity-60 hover:opacity-100'}`}
              >
                Most edited
              </button>
              <button
                onClick={() => setFileSort('recent')}
                className={`px-3 py-1 transition-colors ${fileSort === 'recent' ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'opacity-60 hover:opacity-100'}`}
              >
                Most recent
              </button>
            </div>
          </div>

          {sortedFiles.length === 0 ? (
            <div className="text-sm opacity-40 text-center py-12">No file edits recorded yet.</div>
          ) : (
            <div className="space-y-1">
              {sortedFiles.map((f, i) => (
                <FileRow key={i} file={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tools tab ── */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          {projectStats && (() => {
            const total = projectStats.toolUsage.reduce((s, t) => s + t.count, 0);
            const unique = projectStats.toolUsage.length;
            const avgPerSession = sessions.length > 0 ? (total / sessions.length).toFixed(1) : '0';
            return (
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total tool calls" value={String(total)} />
                <StatCard label="Unique tools" value={String(unique)} />
                <StatCard label="Avg per session" value={avgPerSession} />
              </div>
            );
          })()}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Breakdown</h2>
            <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 space-y-2">
              {(projectStats?.toolUsage ?? []).length === 0 ? (
                <div className="text-sm opacity-40 text-center py-6">No tool calls recorded yet.</div>
              ) : (projectStats?.toolUsage ?? []).map(item => (
                <div key={item.tool} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-mono text-right shrink-0 truncate" style={{ color: toolColor(item.tool) }} title={item.tool}>
                    {item.tool}
                  </div>
                  <div className="flex-1 h-5 bg-[var(--vscode-input-background)] rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${projectStats!.toolUsage[0].count > 0 ? (item.count / projectStats!.toolUsage[0].count) * 100 : 0}%`,
                        background: toolColor(item.tool),
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <div className="text-xs opacity-60 shrink-0 w-20 text-right">
                    {item.count} ({item.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Recent Calls</h2>
            <div className="space-y-1">
              {(projectStats?.recentToolCalls ?? []).length === 0 ? (
                <div className="text-sm opacity-40 text-center py-6">No tool calls recorded yet.</div>
              ) : (projectStats?.recentToolCalls ?? []).map((tc, i) => (
                <ToolCallRow key={i} tc={tc} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── CLAUDE.md tab ── */}
      {activeTab === 'claudemd' && (
        <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]">
          {config?.claudeMd ? (
            <MarkdownView content={config.claudeMd} />
          ) : (
            <div className="text-sm opacity-40 text-center py-12">No CLAUDE.md found in this project.</div>
          )}
        </div>
      )}

      {/* ── Commands tab ── */}
      {activeTab === 'commands' && (
        <div className="space-y-4">
          {(!config?.commands || config.commands.length === 0) ? (
            <div className="text-sm opacity-40 text-center py-12">No custom commands found in .claude/commands/.</div>
          ) : (
            <>
              <p className="text-xs opacity-50">{config.commands.length} command{config.commands.length !== 1 ? 's' : ''} in .claude/commands/</p>
              {config.commands.map(cmd => (
                <CommandBlock key={cmd.name} command={cmd} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Weekly tab ── */}
      {activeTab === 'weekly' && (
        <WeeklyStatsTab projectStats={projectStats} />
      )}

      {/* ── MCP Servers tab ── */}
      {activeTab === 'mcp' && (
        <div>
          {config && Object.keys(config.mcpServers).length > 0 ? (
            <div className="space-y-2">
              {Object.values(config.mcpServers).map(server => (
                <McpServerRow key={server.name} server={server} />
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-40 text-center py-12">No MCP servers configured for this project.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab-specific row components ────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
      <div className="text-xs opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function FileRow({ file }: { file: ProjectFile }) {
  const typeColor = file.type === 'created' ? 'text-green-400' : file.type === 'both' ? 'text-blue-400' : 'text-yellow-400';
  const typeLabel = file.type === 'created' ? 'created' : file.type === 'both' ? 'created+edited' : 'edited';

  return (
    <div className="flex items-center gap-3 rounded px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate" title={file.fullPath}>{file.file}</span>
          <span className={`text-xs shrink-0 ${typeColor}`}>{typeLabel}</span>
        </div>
        <div className="text-xs opacity-40 truncate font-mono mt-0.5" title={file.fullPath}>
          {file.fullPath}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold">{file.editCount}×</div>
        <div className="text-xs opacity-40">{timeAgo(file.lastTouched)}</div>
      </div>
    </div>
  );
}

function McpServerRow({ server }: { server: McpServer }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm">{server.name}</span>
        {server.type && (
          <span className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded">
            {server.type}
          </span>
        )}
        {server.toolCallCount > 0 && (
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono">
            {server.toolCallCount} call{server.toolCallCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {server.command && (
        <div className="text-xs opacity-60 font-mono mt-1">
          <span className="opacity-50">command: </span>{server.command}
        </div>
      )}
      {server.url && (
        <div className="text-xs opacity-60 mt-1">
          <span className="opacity-50">url: </span>{server.url}
        </div>
      )}
    </div>
  );
}

function ToolCallRow({ tc }: { tc: ProjectToolCall }) {
  const [open, setOpen] = useState(false);
  const hint = (tc.input?.file_path as string | undefined)
    ?? (tc.input?.command as string | undefined)
    ?? (tc.input?.pattern as string | undefined)
    ?? (tc.input?.query as string | undefined)
    ?? (tc.input?.prompt as string | undefined)
    ?? '';
  const hasFullInput = Object.keys(tc.input ?? {}).length > 0;

  return (
    <div className="rounded p-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-xs font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded"
          style={{ background: toolColor(tc.tool) + '22', color: toolColor(tc.tool) }}
        >
          {tc.tool}
        </span>
        {hint && (
          <span className="text-xs opacity-60 truncate font-mono" title={hint}>{hint}</span>
        )}
        <span className="text-xs opacity-30 ml-auto shrink-0">{timeAgo(tc.timestamp || tc.sessionDate)}</span>
        {hasFullInput && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs opacity-40 hover:opacity-80 shrink-0 ml-1"
          >
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>
      {open && hasFullInput && (
        <pre className="mt-1 text-xs opacity-60 font-mono whitespace-pre-wrap bg-[var(--vscode-input-background)] rounded p-2 overflow-x-auto">
          {JSON.stringify(tc.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SubagentRow({ session, parentSessions }: { session: Session; parentSessions: Session[] }) {
  const parent = session.parentSessionId
    ? parentSessions.find(s => s.id === session.parentSessionId)
    : null;

  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono shrink-0">subagent</span>
        <span className="text-xs font-medium">{new Date(session.startTime).toLocaleString([], { hour12: true })}</span>
        {session.hasThinking && <span title="Used extended thinking" className="text-yellow-400 text-xs">⚡</span>}
        <span className="text-xs opacity-40 ml-auto">{formatDuration(session.durationMs)}</span>
      </div>

      {session.sessionSummary && (
        <div className="text-xs italic opacity-60 truncate" title={session.sessionSummary}>{session.sessionSummary}</div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-60">
        <span>{formatTokens(session.totalTokens)} tokens</span>
        <span>${session.costUsd.toFixed(4)}</span>
        <span>{session.promptCount} prompt{session.promptCount !== 1 ? 's' : ''}</span>
        <span>{session.toolCallCount} tool call{session.toolCallCount !== 1 ? 's' : ''}</span>
        {session.filesModified.length > 0 && <span>{session.filesModified.length} file{session.filesModified.length !== 1 ? 's' : ''} modified</span>}
      </div>

      {parent && (
        <div className="text-xs opacity-40 mt-1">
          Parent: <span className="font-mono">{parent.sessionSummary?.slice(0, 60) ?? parent.id.slice(0, 8)}</span>
        </div>
      )}
      {!parent && session.parentSessionId && (
        <div className="text-xs opacity-40 mt-1 font-mono">Parent ID: {session.parentSessionId.slice(0, 8)}…</div>
      )}
    </div>
  );
}
