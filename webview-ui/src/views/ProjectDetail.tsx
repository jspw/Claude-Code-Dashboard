import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Session, Turn, ProjectConfig, McpServer, ProjectStats, ProjectFile, ProjectToolCall, SessionTodoSnapshot, ClaudeCommit, HookConfig, MemoryFile, PlanFile } from '../types';
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
  projectTodos?: SessionTodoSnapshot[];
  claudeCommits?: ClaudeCommit[];
}

type TabGroup = 'activity' | 'knowledge' | 'workflow';
type Tab = 'sessions' | 'claudemd' | 'tools' | 'mcp' | 'subagents' | 'files' | 'commands' | 'weekly' | 'memory' | 'plans' | 'todos' | 'commits' | 'settings';

const TAB_META: Record<Tab, { label: string; description: string; group: TabGroup }> = {
  sessions:  { label: 'Sessions', description: 'Browse runs and inspect full turn history.', group: 'activity' },
  weekly:    { label: 'Trends', description: 'See the recent usage rhythm for this project.', group: 'activity' },
  tools:     { label: 'Tool Usage', description: 'Review tool usage, recent calls, and patterns.', group: 'activity' },
  subagents: { label: 'Subagents', description: 'Inspect Claude subagent definitions and delegated runs.', group: 'knowledge' },
  files:     { label: 'Files', description: 'Track which files were touched and when.', group: 'activity' },
  memory:    { label: 'Memory', description: 'Read saved memory notes and working agreements.', group: 'knowledge' },
  claudemd:  { label: 'Claude Guide', description: 'Reference the project guidance Claude sees.', group: 'knowledge' },
  commands:  { label: 'Commands', description: 'Open reusable custom slash commands for this project.', group: 'knowledge' },
  mcp:       { label: 'MCP', description: 'Inspect configured MCP integrations and usage.', group: 'knowledge' },
  plans:     { label: 'Plans', description: 'Review saved project plans and roadmap documents.', group: 'workflow' },
  todos:     { label: 'Todos', description: 'Review final todo snapshots captured in sessions.', group: 'workflow' },
  commits:   { label: 'Commits', description: 'Scan Claude co-authored commit history.', group: 'activity' },
  settings:  { label: 'Automation', description: 'Check hooks and project-level configuration.', group: 'knowledge' },
};

const TAB_GROUPS: Array<{ key: TabGroup; label: string; description: string; tabs: Tab[] }> = [
  {
    key: 'activity',
    label: 'History',
    description: 'Sessions, usage, files, and commits.',
    tabs: ['sessions', 'weekly', 'files', 'tools', 'commits'],
  },
  {
    key: 'knowledge',
    label: 'Setup',
    description: 'Claude guidance, memory, tools, and automation.',
    tabs: ['claudemd', 'memory', 'commands', 'mcp', 'subagents', 'settings'],
  },
  {
    key: 'workflow',
    label: 'Workflow',
    description: 'Plans and todos for active work.',
    tabs: ['plans', 'todos'],
  },
];

export default function ProjectDetail({ project, sessions, subagentSessions, config, projectStats, projectFiles, projectTodos, claudeCommits }: Props) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [groupSelection, setGroupSelection] = useState<Record<TabGroup, Tab>>({
    activity: 'sessions',
    knowledge: 'claudemd',
    workflow: 'plans',
  });
  const [fileSort, setFileSort] = useState<'edits' | 'recent'>('edits');
  const [selectedMemoryFileName, setSelectedMemoryFileName] = useState<string | null>(null);
  const [selectedPlanFileName, setSelectedPlanFileName] = useState<string | null>(null);
  const memoryPreviewRef = useRef<HTMLDivElement | null>(null);
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

  const projectSettingsEntries = Object.entries(config?.projectSettings ?? {}).filter(
    ([k]) => k !== 'mcpServers' && k !== 'hooks'
  );
  const plans = config?.plans ?? [];
  const selectedPlan = plans.find(plan => plan.fileName === selectedPlanFileName) ?? plans[0] ?? null;
  const memoryFiles = config?.memory.files ?? [];
  const memoryReferenceNames = extractMemoryReferences(config?.memory.index ?? '');
  const memoryReferenceNameSet = new Set(memoryReferenceNames);
  const referencedMemoryFiles = memoryReferenceNames
    .map(referenceName => memoryFiles.find(file => normalizeMemoryFileName(file.fileName) === referenceName))
    .filter((file): file is MemoryFile => Boolean(file));
  const unlinkedMemoryFiles = memoryFiles.filter(file => !memoryReferenceNameSet.has(normalizeMemoryFileName(file.fileName)));
  const selectedMemory = memoryFiles.find(file => file.fileName === selectedMemoryFileName)
    ?? referencedMemoryFiles[0]
    ?? memoryFiles[0]
    ?? null;
  const memoryTypeCount = new Set(memoryFiles.map(f => f.type)).size;
  const hasMemoryIndex = Boolean(config?.memory.index);
  const totalTodos = (projectTodos ?? []).reduce((sum, snapshot) => sum + snapshot.todos.length, 0);
  const completedTodos = (projectTodos ?? []).reduce(
    (sum, snapshot) => sum + snapshot.todos.filter(todo => todo.status === 'completed').length,
    0
  );
  const activeTodos = Math.max(0, totalTodos - completedTodos);
  const hooksCount = config?.hooks.length ?? 0;
  const commitFilesChanged = (claudeCommits ?? []).reduce((sum, commit) => sum + commit.filesChanged, 0);
  const sortedFiles = [...(projectFiles ?? [])].sort((a, b) =>
    fileSort === 'recent' ? b.lastTouched - a.lastTouched : b.editCount - a.editCount
  );
  const tabBadges: Record<Tab, string | null> = {
    sessions: sorted.length > 0 ? String(sorted.length) : null,
    weekly: projectStats?.weeklyStats.sessions ? `${projectStats.weeklyStats.sessions} wk` : null,
    tools: projectStats?.toolUsage.length ? `${projectStats.toolUsage.length}` : null,
    subagents: subagentSessions?.length ? String(subagentSessions.length) : null,
    files: sortedFiles.length > 0 ? String(sortedFiles.length) : null,
    memory: config?.memory.files.length ? String(config.memory.files.length) : (config?.memory.index ? 'index' : null),
    claudemd: config?.claudeMd ? 'guide' : null,
    commands: config?.commands.length ? String(config.commands.length) : null,
    mcp: Object.keys(config?.mcpServers ?? {}).length ? String(Object.keys(config?.mcpServers ?? {}).length) : null,
    plans: plans.length ? String(plans.length) : null,
    todos: projectTodos?.length ? String(projectTodos.length) : null,
    commits: claudeCommits?.length ? String(claudeCommits.length) : null,
    settings: (config?.hooks.length ?? 0) + projectSettingsEntries.length > 0
      ? String((config?.hooks.length ?? 0) + projectSettingsEntries.length)
      : null,
  };
  const activeMeta = TAB_META[activeTab];
  const activeGroup = activeMeta.group;
  const activeGroupMeta = TAB_GROUPS.find(group => group.key === activeGroup) ?? TAB_GROUPS[0];

  const selectTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setGroupSelection(prev => ({ ...prev, [TAB_META[tab].group]: tab }));
  }, []);

  const selectGroup = useCallback((group: TabGroup) => {
    const nextTab = groupSelection[group] ?? TAB_GROUPS.find(candidate => candidate.key === group)?.tabs[0] ?? 'sessions';
    setActiveTab(nextTab);
  }, [groupSelection]);

  const focusMemoryFile = useCallback((fileName: string) => {
    setSelectedMemoryFileName(fileName);
    requestAnimationFrame(() => {
      memoryPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleMemoryLinkClick = useCallback((href: string) => {
    const normalizedHref = normalizeMemoryFileName(href);
    const linkedFile = memoryFiles.find(file => normalizeMemoryFileName(file.fileName) === normalizedHref);
    if (linkedFile) {
      focusMemoryFile(linkedFile.fileName);
    }
  }, [focusMemoryFile, memoryFiles]);

  useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanFileName(null);
      return;
    }

    if (!selectedPlanFileName || !plans.some(plan => plan.fileName === selectedPlanFileName)) {
      setSelectedPlanFileName(plans[0].fileName);
    }
  }, [plans, selectedPlanFileName]);

  useEffect(() => {
    if (memoryFiles.length === 0) {
      setSelectedMemoryFileName(null);
      return;
    }

    if (!selectedMemoryFileName || !memoryFiles.some(file => file.fileName === selectedMemoryFileName)) {
      const nextMemory = referencedMemoryFiles[0] ?? memoryFiles[0];
      setSelectedMemoryFileName(nextMemory?.fileName ?? null);
    }
  }, [memoryFiles, referencedMemoryFiles, selectedMemoryFileName]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          {project.isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.isActive && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">live</span>}
          <div className="ml-auto flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2 mt-3">
          {project.techStack?.map(t => (
            <span key={t} className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total tokens" value={formatTokens(project.totalTokens)} />
        <StatCard label="Estimated cost" value={`$${project.totalCostUsd.toFixed(3)}`} />
        <StatCard label="Sessions" value={String(project.sessionCount)} />
      </div>

      {/* Tab navigation */}
      <nav className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
          <div className="grid grid-cols-3 gap-2">
            {TAB_GROUPS.map(group => (
              <TabGroupButton
                key={group.key}
                label={group.label}
                description={group.description}
                active={activeGroup === group.key}
                onClick={() => selectGroup(group.key)}
              />
            ))}
          </div>
          <p className="text-sm opacity-60 mt-3 max-w-2xl">{activeGroupMeta.description}</p>
        </div>
        <div className="px-2 pt-2">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {activeGroupMeta.tabs.map(tab => (
              <TabButton
                key={tab}
                label={TAB_META[tab].label}
                badge={tabBadges[tab]}
                active={activeTab === tab}
                onClick={() => selectTab(tab)}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-45">
              {TAB_GROUPS.find(group => group.key === activeMeta.group)?.label}
            </div>
            <h2 className="text-xl font-semibold mt-1">{activeMeta.label}</h2>
            <p className="text-sm opacity-60 mt-1 max-w-2xl">{activeMeta.description}</p>
          </div>
          {tabBadges[activeTab] && (
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {tabBadges[activeTab]}
            </span>
          )}
        </div>

        {/* ── Sessions tab ── */}
        {activeTab === 'sessions' && (
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="min-w-0 overflow-hidden xl:col-span-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Sessions</h3>
              <div className="space-y-1 overflow-y-auto max-h-[70vh]">
                {sorted.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSession(s)}
                    className={`w-full text-left rounded-xl p-3 transition-colors text-sm ${
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

            <section className="min-w-0 overflow-hidden xl:col-span-2">
              {selectedSession ? (
                <SessionDetail key={selectedSession.id} session={selectedSession} turns={turns} loading={turnsLoading} />
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--vscode-panel-border)] opacity-50 text-sm text-center px-4 py-12">
                  Select a session to view details
                </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-60">{sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''} touched across all sessions</span>
              <div className="ml-auto flex rounded-lg overflow-hidden border border-[var(--vscode-panel-border)] text-xs">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total tool calls" value={String(total)} />
                  <StatCard label="Unique tools" value={String(unique)} />
                  <StatCard label="Avg per session" value={avgPerSession} />
                </div>
              );
            })()}

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Breakdown</h3>
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
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Recent Calls</h3>
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

        {/* ── Memory tab ── */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            {(!config?.memory || (memoryFiles.length === 0 && !hasMemoryIndex)) ? (
              <EmptyPanel
                title="No memory files found for this project."
                detail="Saved project memory and working agreements will appear here once Claude records them."
              />
            ) : (
              <>
                {hasMemoryIndex && (
                  <section className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
                    <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                          MEMORY.md
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.16em] opacity-45">Source of Truth</span>
                      </div>
                      <h3 className="text-base font-semibold mt-2">Project Memory Index</h3>
                      <p className="text-sm opacity-60 mt-1 max-w-2xl">
                        This is the main memory document. Click any markdown reference below to open its supporting memory file.
                      </p>
                    </div>
                    <MarkdownView content={config?.memory.index ?? ''} onLinkClick={handleMemoryLinkClick} />
                  </section>
                )}
                {referencedMemoryFiles.length > 0 && (
                  <MemoryReferenceList
                    title="Referenced Files"
                    detail="References discovered from markdown links and file mentions inside MEMORY.md."
                    files={referencedMemoryFiles}
                    selectedFileName={selectedMemory?.fileName ?? null}
                    onSelect={focusMemoryFile}
                  />
                )}
                {!hasMemoryIndex && memoryFiles.length > 0 && (
                  <MemoryReferenceList
                    title="Memory Files"
                    detail={`${memoryFiles.length} supporting memory file${memoryFiles.length !== 1 ? 's' : ''} across ${memoryTypeCount} categor${memoryTypeCount !== 1 ? 'ies' : 'y'}.`}
                    files={memoryFiles}
                    selectedFileName={selectedMemory?.fileName ?? null}
                    onSelect={focusMemoryFile}
                  />
                )}
                {selectedMemory ? (
                  <div ref={memoryPreviewRef}>
                    <MemoryPreviewPanel
                      memory={selectedMemory}
                      referenced={memoryReferenceNameSet.has(normalizeMemoryFileName(selectedMemory.fileName))}
                    />
                  </div>
                ) : (
                  <EmptyPanel
                    title="No memory file selected."
                    detail="Choose a referenced memory file to preview its content here."
                    compact
                  />
                )}
                {hasMemoryIndex && unlinkedMemoryFiles.length > 0 && (
                  <MemoryReferenceList
                    title="Other Memory Files"
                    detail="These files are stored in memory but are not currently linked from MEMORY.md."
                    files={unlinkedMemoryFiles}
                    selectedFileName={selectedMemory?.fileName ?? null}
                    onSelect={focusMemoryFile}
                    subdued
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Plans tab ── */}
        {activeTab === 'plans' && (
          <div className="space-y-4">
            {plans.length === 0 ? (
              <EmptyPanel
                title="No plan files found in this project."
                detail="Add plan documents like PLAN.md or .claude/plans/*.md to surface them here."
              />
            ) : (
              <>
                {plans.length > 1 && (
                  <PlanReferenceList
                    files={plans}
                    selectedFileName={selectedPlan?.fileName ?? null}
                    onSelect={setSelectedPlanFileName}
                  />
                )}
                {selectedPlan && (
                  <PlanPreviewPanel plan={selectedPlan} totalPlans={plans.length} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Todos tab ── */}
        {activeTab === 'todos' && (
          <div className="space-y-4">
            {(!projectTodos || projectTodos.length === 0) ? (
              <EmptyPanel
                title="No todo lists found in session history."
                detail="Todo snapshots show the last recorded checklist state from each session."
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStatCard label="Todo Sessions" value={`${projectTodos.length}`} />
                  <MiniStatCard label="Completed" value={`${completedTodos}`} tone="success" />
                  <MiniStatCard label="Open Items" value={`${activeTodos}`} tone={activeTodos > 0 ? 'warning' : 'neutral'} />
                </div>
                <span className="text-sm opacity-60">{projectTodos.length} session{projectTodos.length !== 1 ? 's' : ''} with saved todo state</span>
                {projectTodos.map((snapshot, index) => (
                  <TodoSnapshotCard
                    key={snapshot.sessionId}
                    snapshot={snapshot}
                    defaultExpanded={projectTodos.length === 1 || index === 0}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Commits tab ── */}
        {activeTab === 'commits' && (
          <div className="space-y-4">
            {(!claudeCommits || claudeCommits.length === 0) ? (
              <EmptyPanel
                title="No Claude co-authored commits found in this project."
                detail="Commits show up here when git history contains a Claude co-author trailer."
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStatCard label="Claude Commits" value={`${claudeCommits.length}`} />
                  <MiniStatCard label="Files Changed" value={`${commitFilesChanged}`} />
                  <MiniStatCard label="Most Recent" value={timeAgo(claudeCommits[0].date)} />
                </div>
                <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">Commit History</div>
                      <p className="text-sm opacity-70 mt-1">
                        {claudeCommits.length} commit{claudeCommits.length !== 1 ? 's' : ''} co-authored by Claude
                      </p>
                    </div>
                    <span className="ml-auto text-xs opacity-45">
                      Ordered by most recent activity
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {claudeCommits.map(commit => (
                    <CommitRow key={commit.hash} commit={commit} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Settings tab ── */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStatCard label="Hooks" value={`${hooksCount}`} />
              <MiniStatCard label="Project Settings" value={`${projectSettingsEntries.length}`} />
              <MiniStatCard label="Automation Surface" value={hooksCount > 0 ? 'Configured' : 'Manual'} tone={hooksCount > 0 ? 'success' : 'neutral'} />
            </div>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Hooks</h3>
              {(!config?.hooks || config.hooks.length === 0) ? (
                <EmptyPanel
                  title="No hooks configured."
                  detail="Hooks let the project run automation around tool usage and stop events."
                  compact
                />
              ) : (
                <div className="space-y-2">
                  {config.hooks.map((hook, i) => (
                    <HookRow key={i} hook={hook} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Project Settings</h3>
              {projectSettingsEntries.length === 0 ? (
                <EmptyPanel
                  title="No project-specific settings found."
                  detail="Only settings that differ from default/global configuration appear here."
                  compact
                />
              ) : (
                <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
                  {projectSettingsEntries.map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 border-[var(--vscode-panel-border)]">
                      <span className="text-xs font-mono font-semibold shrink-0 opacity-70">{key}</span>
                      <span className="text-xs font-mono opacity-50 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab-specific row components ────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
      <div className="text-xs opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function MiniStatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const toneClass = tone === 'success'
    ? 'text-green-300'
    : tone === 'warning'
    ? 'text-yellow-300'
    : 'text-[var(--vscode-editor-foreground)]';

  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function EmptyPanel({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed border-[var(--vscode-panel-border)] text-center ${compact ? 'px-4 py-8' : 'px-4 py-12'}`}>
      <div className="text-sm opacity-50">{title}</div>
      <div className="text-xs opacity-40 mt-2 max-w-xl mx-auto">{detail}</div>
    </div>
  );
}

function TabButton({ label, badge, active, onClick }: { label: string; badge: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-xl rounded-b-md px-3.5 py-2 text-sm border transition-colors whitespace-nowrap ${
        active
          ? 'border-[var(--vscode-panel-border)] border-b-transparent bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] shadow-[inset_0_-2px_0_0_var(--vscode-button-background)]'
          : 'border-transparent bg-transparent text-[var(--vscode-editor-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          active
            ? 'bg-black/20 text-current'
            : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function TabGroupButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
        active
          ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)]/10'
          : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      <div className="text-sm font-medium whitespace-nowrap">{label}</div>
      <div className="text-xs opacity-55 mt-1 truncate">{description}</div>
    </button>
  );
}

function FileRow({ file }: { file: ProjectFile }) {
  const typeColor = file.type === 'created' ? 'text-green-400' : file.type === 'both' ? 'text-blue-400' : 'text-yellow-400';
  const typeLabel = file.type === 'created' ? 'created' : file.type === 'both' ? 'created+edited' : 'edited';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors">
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
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-4">
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
    <div className="rounded-xl border border-transparent p-2 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors">
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
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-3 space-y-1.5">
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

function memoryTypeColor(type: string): string {
  switch (type) {
    case 'index': return 'text-cyan-300 bg-cyan-500/15';
    case 'user': return 'text-blue-400 bg-blue-500/15';
    case 'feedback': return 'text-yellow-400 bg-yellow-500/15';
    case 'project': return 'text-green-400 bg-green-500/15';
    case 'reference': return 'text-purple-400 bg-purple-500/15';
    default: return 'opacity-60 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]';
  }
}

function normalizeMemoryFileName(fileName: string): string {
  return fileName.trim().replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? fileName.toLowerCase();
}

function extractMemoryReferences(indexContent: string): string[] {
  const references = new Set<string>();
  if (!indexContent.trim()) {
    return [];
  }

  const markdownLinks = indexContent.matchAll(/\[[^\]]+\]\(([^)#?]+\.md)(?:#[^)]+)?\)/gi);
  for (const match of markdownLinks) {
    references.add(normalizeMemoryFileName(match[1]));
  }

  const bareFileMentions = indexContent.matchAll(/\b([A-Za-z0-9._/-]+\.md)\b/gi);
  for (const match of bareFileMentions) {
    references.add(normalizeMemoryFileName(match[1]));
  }

  references.delete('memory.md');
  return Array.from(references);
}

function getMemoryExcerpt(content: string): string {
  const flattened = content.replace(/\s+/g, ' ').trim();
  if (!flattened) {
    return 'No preview available.';
  }
  return flattened.length > 110 ? `${flattened.slice(0, 107)}...` : flattened;
}

function TodoSnapshotCard({ snapshot, defaultExpanded = false }: { snapshot: SessionTodoSnapshot; defaultExpanded?: boolean }) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const completed = snapshot.todos.filter(t => t.status === 'completed').length;
  const total = snapshot.todos.length;
  const allDone = completed === total;
  const inProgress = snapshot.todos.filter(t => t.status === 'in_progress').length;
  const pending = Math.max(0, total - completed - inProgress);
  const sessionLabel = snapshot.sessionSummary || `Session ${snapshot.sessionId.slice(0, 8)}`;
  const startedAt = new Date(snapshot.sessionDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const updatedAt = new Date(snapshot.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
      >
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
          className={`shrink-0 opacity-40 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-45">
            <span className="uppercase tracking-[0.16em]">Session</span>
            <span className="font-mono">{snapshot.sessionId.slice(0, 8)}</span>
            <span>started {startedAt}</span>
          </div>
          <div className="text-sm font-medium truncate opacity-90 mt-1">{sessionLabel}</div>
          <div className="text-xs opacity-50 mt-1">
            Last todo update {timeAgo(snapshot.timestamp)} • {updatedAt}
          </div>
          <div className="text-xs opacity-45 mt-1">
            {total} item{total !== 1 ? 's' : ''} • {completed} done
            {inProgress > 0 ? ` • ${inProgress} in progress` : ''}
            {pending > 0 ? ` • ${pending} pending` : ''}
          </div>
        </div>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${allDone ? 'text-green-400 bg-green-500/15' : 'text-yellow-400 bg-yellow-500/15'}`}>
          {completed}/{total}
        </span>
        <span className="text-xs opacity-30 shrink-0">{timeAgo(snapshot.timestamp)}</span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 border-t border-[var(--vscode-panel-border)] space-y-1.5 pt-3">
          {snapshot.todos.map((todo, i) => (
            <div key={i} className="flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 bg-[var(--vscode-editor-background)]/50">
              {todo.status === 'completed' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-green-400">
                  <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : todo.status === 'in_progress' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-blue-400">
                  <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="3" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 opacity-40">
                  <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
              <span className={todo.status === 'completed' ? 'opacity-50 line-through' : ''}>{todo.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HookRow({ hook }: { hook: HookConfig }) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded font-semibold">{hook.event}</span>
        {hook.matcher && (
          <span className="text-xs opacity-50 font-mono">matcher: {hook.matcher}</span>
        )}
      </div>
      <div className="text-xs opacity-45 uppercase tracking-[0.16em] mb-1">Command</div>
      <div className="text-xs font-mono opacity-70 break-all">{hook.command}</div>
    </div>
  );
}

function CommitRow({ commit }: { commit: ClaudeCommit }) {
  const [copied, setCopied] = useState(false);
  const copyHash = () => {
    navigator.clipboard.writeText(commit.hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-3 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
      <button
        onClick={copyHash}
        title={copied ? 'Copied!' : `Copy full hash: ${commit.hash}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] shrink-0 hover:opacity-80 transition-opacity"
      >
        {commit.shortHash}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" title={commit.subject}>{commit.subject}</div>
        <div className="text-xs opacity-45 mt-1">{commit.author} {commit.filesChanged > 0 && <span>· {commit.filesChanged} file{commit.filesChanged !== 1 ? 's' : ''}</span>}</div>
      </div>
      <span className="text-xs opacity-30 shrink-0">{timeAgo(commit.date)}</span>
    </div>
  );
}

function MemoryReferenceList({
  title,
  detail,
  files,
  selectedFileName,
  onSelect,
  subdued = false,
}: {
  title: string;
  detail: string;
  files: MemoryFile[];
  selectedFileName: string | null;
  onSelect: (fileName: string) => void;
  subdued?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-[var(--vscode-panel-border)] overflow-hidden ${subdued ? 'bg-[var(--vscode-editor-background)]' : 'bg-[var(--vscode-input-background)]'}`}>
      <div className="px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{title}</div>
        <p className="text-xs opacity-55 mt-1">{detail}</p>
      </div>
      <div className="p-2 space-y-1.5">
        {files.map(file => (
          <MemoryEntryButton
            key={file.fileName}
            memory={file}
            selected={selectedFileName === file.fileName}
            onSelect={() => onSelect(file.fileName)}
          />
        ))}
      </div>
    </div>
  );
}

function MemoryEntryButton({ memory, selected, onSelect }: { memory: MemoryFile; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
        selected
          ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
          : 'border-transparent hover:border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium truncate">{memory.name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${memoryTypeColor(memory.type)}`}>
              {memory.type}
            </span>
          </div>
          {memory.description && (
            <div className="text-xs opacity-55 mt-1 line-clamp-2">{memory.description}</div>
          )}
          <div className="text-xs opacity-45 font-mono mt-1">{memory.fileName}</div>
          <div className="text-xs opacity-55 mt-2 leading-relaxed">{getMemoryExcerpt(memory.content)}</div>
        </div>
      </div>
    </button>
  );
}

function MemoryPreviewPanel({ memory, referenced }: { memory: MemoryFile; referenced: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
      <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${memoryTypeColor(memory.type)}`}>
            {memory.type}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${referenced ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>
            {referenced ? 'Referenced In MEMORY.md' : 'Not Linked From MEMORY.md'}
          </span>
        </div>
        <h3 className="text-base font-semibold mt-3">{memory.name}</h3>
        {memory.description && (
          <p className="text-sm opacity-60 mt-1">{memory.description}</p>
        )}
        <div className="text-xs font-mono opacity-45 mt-2">{memory.fileName}</div>
      </div>
      <div className="px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-40 mb-3">Markdown Preview</div>
        <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-4 py-3">
          <MarkdownView content={memory.content} compact />
        </div>
      </div>
    </div>
  );
}

function PlanReferenceList({
  files,
  selectedFileName,
  onSelect,
}: {
  files: PlanFile[];
  selectedFileName: string | null;
  onSelect: (fileName: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">Plans</div>
        <p className="text-xs opacity-55 mt-1">Choose a saved plan to preview its roadmap or execution notes.</p>
      </div>
      <div className="p-2 space-y-1.5">
        {files.map(file => (
          <button
            key={file.fileName}
            onClick={() => onSelect(file.fileName)}
            className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
              selectedFileName === file.fileName
                ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                : 'border-transparent hover:border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]'
            }`}
          >
            <div className="text-sm font-medium">{file.name}</div>
            {file.description && (
              <div className="text-xs opacity-55 mt-1 line-clamp-2">{file.description}</div>
            )}
            <div className="text-xs font-mono opacity-45 mt-1">{file.fileName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanPreviewPanel({ plan, totalPlans }: { plan: PlanFile; totalPlans: number }) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
      <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
            Plan File
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] opacity-45">
            {totalPlans} saved plan{totalPlans !== 1 ? 's' : ''}
          </span>
        </div>
        <h3 className="text-base font-semibold mt-3">{plan.name}</h3>
        {plan.description && (
          <p className="text-sm opacity-60 mt-1">{plan.description}</p>
        )}
        <div className="text-xs font-mono opacity-45 mt-2">{plan.fileName}</div>
      </div>
      <div className="px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-40 mb-3">Markdown Preview</div>
        <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-4 py-3">
          <MarkdownView content={plan.content} compact />
        </div>
      </div>
    </div>
  );
}
