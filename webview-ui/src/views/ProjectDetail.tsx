import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Session, Turn, ProjectConfig, McpServer, ProjectStats, ProjectFile, ProjectToolCall, SessionTodoSnapshot, ClaudeCommit, HookConfig, MemoryFile, PlanFile } from '../types';
import { vscode } from '../vscode';
import { formatTokens, formatCost, formatAvg, formatDuration, timeAgo, COST_DISCLAIMER } from '../utils/format';
import { toolColor } from '../utils/toolColor';
import { MarkdownView, CommandBlock, MentionText } from '../components/MarkdownView';
import SessionDetail, { modelLabel, modelBadgeColor } from '../components/SessionDetail';
import WeeklyStatsTab from '../components/WeeklyStatsTab';

interface Props {
  project: Project;
  sessions: Session[];
  subagentSessions?: Session[];
  config?: ProjectConfig;
  projectStats?: ProjectStats;
  projectFiles?: ProjectFile[];
  projectTodos?: SessionTodoSnapshot[];
  claudeCommits?: ClaudeCommit[];
  initialSessionId?: string;
}

type Tab = 'overview' | 'sessions' | 'activity' | 'setup' | 'work';

const TAB_LABELS: Array<{ key: Tab; label: string; description: string }> = [
  { key: 'overview', label: 'Overview', description: 'At-a-glance stats, recent sessions, and quick links.' },
  { key: 'sessions', label: 'Sessions', description: 'Browse runs and inspect full turn history.' },
  { key: 'activity', label: 'Activity', description: 'What happened here over time — usage, files, tools, and commits.' },
  { key: 'setup', label: 'Setup', description: 'How Claude is configured for this project.' },
  { key: 'work', label: 'Work', description: 'Plans and todos for active work.' },
];

// Activity tab shows a bounded preview of touched files so the list doesn't
// bury the Tool usage / Commits sections below it.
const FILE_PREVIEW_COUNT = 8;

// ── Session day grouping ────────────────────────────────────────────────────────
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(ts) === dayKey(today.getTime())) { return 'Today'; }
  if (dayKey(ts) === dayKey(yesterday.getTime())) { return 'Yesterday'; }
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ProjectDetail({ project, sessions, subagentSessions, config, projectStats, projectFiles, projectTodos, claudeCommits, initialSessionId }: Props) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sessionFilter, setSessionFilter] = useState('');
  const [showSubagents, setShowSubagents] = useState(false);
  const [fileSort, setFileSort] = useState<'edits' | 'recent'>('edits');
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [selectedMemoryFileName, setSelectedMemoryFileName] = useState<string | null>(null);
  const [selectedPlanFileName, setSelectedPlanFileName] = useState<string | null>(null);
  const memoryPreviewRef = useRef<HTMLDivElement | null>(null);
  const sessionDetailRef = useRef<HTMLElement | null>(null);
  const sorted = [...(sessions ?? [])].sort((a, b) => b.startTime - a.startTime);

  const selectSession = useCallback((session: Session) => {
    setSelectedSession(session);
    setTurns([]);
    setTurnsLoading(true);
    vscode.postMessage({ type: 'getSessionTurns', sessionId: session.id });
    requestAnimationFrame(() => {
      sessionDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Turn responses + deep-link session selection from the dashboard Sessions tab.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'sessionTurns' && msg.sessionId === selectedSession?.id) {
        setTurns(msg.turns ?? []);
        setTurnsLoading(false);
      }
      if (msg.type === 'selectSession' && msg.sessionId) {
        const target = (sessions ?? []).find(s => s.id === msg.sessionId);
        if (target) { setActiveTab('sessions'); selectSession(target); }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedSession?.id, sessions, selectSession]);

  // Auto-open the deep-linked session on first render.
  const didInitialSelect = useRef(false);
  useEffect(() => {
    if (didInitialSelect.current || !initialSessionId) { return; }
    const target = (sessions ?? []).find(s => s.id === initialSessionId);
    if (target) {
      didInitialSelect.current = true;
      setActiveTab('sessions');
      selectSession(target);
    }
  }, [initialSessionId, sessions, selectSession]);

  const focusMemoryFile = useCallback((fileName: string) => {
    setSelectedMemoryFileName(fileName);
    requestAnimationFrame(() => {
      memoryPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

  const filteredSessions = sessionFilter
    ? sorted.filter(s => (s.sessionSummary ?? '').toLowerCase().includes(sessionFilter.toLowerCase()))
    : sorted;

  const tabBadges: Record<Tab, string | null> = {
    overview: null,
    sessions: sorted.length > 0 ? String(sorted.length) : null,
    activity: null,
    setup: null,
    work: (plans.length + (projectTodos?.length ?? 0)) > 0 ? String(plans.length + (projectTodos?.length ?? 0)) : null,
  };

  const hasWork = plans.length > 0 || (projectTodos?.length ?? 0) > 0;
  const visibleTabs = TAB_LABELS.filter(t => t.key !== 'work' || hasWork);
  const activeMeta = TAB_LABELS.find(t => t.key === activeTab) ?? TAB_LABELS[0];

  useEffect(() => {
    if (plans.length === 0) { setSelectedPlanFileName(null); return; }
    if (!selectedPlanFileName || !plans.some(plan => plan.fileName === selectedPlanFileName)) {
      setSelectedPlanFileName(plans[0].fileName);
    }
  }, [plans, selectedPlanFileName]);

  useEffect(() => {
    if (memoryFiles.length === 0) { setSelectedMemoryFileName(null); return; }
    if (!selectedMemoryFileName || !memoryFiles.some(file => file.fileName === selectedMemoryFileName)) {
      const nextMemory = referencedMemoryFiles[0] ?? memoryFiles[0];
      setSelectedMemoryFileName(nextMemory?.fileName ?? null);
    }
  }, [memoryFiles, referencedMemoryFiles, selectedMemoryFileName]);

  const handleMemoryLinkClick = useCallback((href: string) => {
    const normalizedHref = normalizeMemoryFileName(href);
    const linkedFile = memoryFiles.find(file => normalizeMemoryFileName(file.fileName) === normalizedHref);
    if (linkedFile) { focusMemoryFile(linkedFile.fileName); }
  }, [focusMemoryFile, memoryFiles]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          {project.isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mt-2" />}
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.isActive && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">live</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <ExportMenu />
          </div>
        </div>
        <button
          onClick={() => vscode.postMessage({ type: 'openFolder', path: project.path })}
          className="text-xs opacity-50 hover:opacity-100 hover:underline font-mono transition-opacity text-left truncate max-w-full"
          title={`Open ${project.path}`}
        >
          {project.path}
        </button>
        <div className="flex flex-wrap gap-2 mt-3">
          {project.techStack?.map(t => (
            <span key={t} className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
        <div className="px-2 pt-2">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {visibleTabs.map(tab => (
              <TabButton
                key={tab.key}
                label={tab.label}
                badge={tabBadges[tab.key]}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--vscode-panel-border)]">
          <p className="text-sm opacity-60">{activeMeta.description}</p>
        </div>
      </nav>

      <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total tokens" value={formatTokens(project.totalTokens)} />
              <StatCard label="Est. cost" value={formatCost(project.totalCostUsd)} hint={COST_DISCLAIMER} />
              <StatCard label="Sessions" value={String(project.sessionCount)} />
              <StatCard label="Last active" value={timeAgo(project.lastActive)} />
            </div>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60">Recent sessions</h3>
                {sorted.length > 3 && (
                  <button onClick={() => setActiveTab('sessions')} className="text-xs opacity-60 hover:opacity-100 transition-opacity">View all →</button>
                )}
              </div>
              {sorted.length === 0 ? (
                <EmptyPanel title="No sessions yet." detail="Run a Claude Code session in this project to see it here." compact />
              ) : (
                <div className="space-y-1">
                  {sorted.slice(0, 3).map(s => (
                    <SessionListItem key={s.id} session={s} selected={false} onSelect={() => { setActiveTab('sessions'); selectSession(s); }} />
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <QuickLink label="Files touched" value={sortedFiles.length} onClick={() => setActiveTab('activity')} />
              <QuickLink label="Tools used" value={projectStats?.toolUsage.length ?? 0} onClick={() => setActiveTab('activity')} />
              <QuickLink label="Open todos" value={activeTodos} onClick={() => hasWork && setActiveTab('work')} tone={activeTodos > 0 ? 'warning' : 'neutral'} />
            </div>
          </div>
        )}

        {/* ── Sessions tab ── */}
        {activeTab === 'sessions' && (
          <div className="grid gap-4 xl:grid-cols-3">
            <section className={`min-w-0 overflow-hidden xl:col-span-1 ${selectedSession ? 'hidden xl:block' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60">Sessions</h3>
                <div className="ml-auto flex items-center gap-2">
                  {subagentSessions && subagentSessions.length > 0 && (
                    <button
                      onClick={() => setShowSubagents(s => !s)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${showSubagents ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300' : 'border-[var(--vscode-panel-border)] opacity-60 hover:opacity-100'}`}
                    >
                      Subagents ({subagentSessions.length})
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={sessionFilter}
                onChange={e => setSessionFilter(e.target.value)}
                placeholder="Filter sessions…"
                className="w-full text-xs px-2.5 py-1.5 mb-3 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] focus:outline-none"
              />
              {showSubagents ? (
                <div className="space-y-2 overflow-y-auto max-h-[70vh]">
                  {[...(subagentSessions ?? [])].sort((a, b) => b.startTime - a.startTime).map(s => (
                    <SubagentRow key={s.id} session={s} parentSessions={sessions} />
                  ))}
                </div>
              ) : (
                <GroupedSessionList
                  sessions={filteredSessions}
                  selectedId={selectedSession?.id ?? null}
                  onSelect={selectSession}
                />
              )}
            </section>

            <section ref={sessionDetailRef} className={`min-w-0 overflow-hidden xl:col-span-2 ${selectedSession ? '' : 'hidden xl:block'}`}>
              {selectedSession ? (
                <>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="xl:hidden flex items-center gap-1.5 text-xs px-2.5 py-1.5 mb-3 rounded border border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7.5 2.5 4 6l3.5 3.5" />
                    </svg>
                    All sessions
                  </button>
                  <SessionDetail key={selectedSession.id} session={selectedSession} turns={turns} loading={turnsLoading} />
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--vscode-panel-border)] opacity-50 text-sm text-center px-4 py-12">
                  Select a session to view details
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Activity tab ── */}
        {activeTab === 'activity' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Usage trend</h3>
              <WeeklyStatsTab projectStats={projectStats} />
            </section>

            <section>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60">{sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''} touched</h3>
                <div className="ml-auto flex rounded-lg overflow-hidden border border-[var(--vscode-panel-border)] text-xs">
                  <button onClick={() => setFileSort('edits')} className={`px-3 py-1 transition-colors ${fileSort === 'edits' ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'opacity-60 hover:opacity-100'}`}>Most edited</button>
                  <button onClick={() => setFileSort('recent')} className={`px-3 py-1 transition-colors ${fileSort === 'recent' ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'opacity-60 hover:opacity-100'}`}>Most recent</button>
                </div>
              </div>
              {sortedFiles.length === 0 ? (
                <EmptyPanel title="No file edits recorded yet." detail="Files Claude creates or edits will appear here." compact />
              ) : (
                <div className="space-y-1">
                  {(showAllFiles ? sortedFiles : sortedFiles.slice(0, FILE_PREVIEW_COUNT)).map((f, i) => <FileRow key={i} file={f} />)}
                  {sortedFiles.length > FILE_PREVIEW_COUNT && (
                    <button
                      onClick={() => setShowAllFiles(v => !v)}
                      className="w-full text-xs py-2 mt-1 rounded-lg border border-[var(--vscode-panel-border)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                    >
                      {showAllFiles ? 'Show less' : `Show all ${sortedFiles.length} files`}
                    </button>
                  )}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Tool usage</h3>
              {projectStats && (() => {
                const total = projectStats.toolUsage.reduce((s, t) => s + t.count, 0);
                const unique = projectStats.toolUsage.length;
                const avgPerSession = sessions.length > 0 ? formatAvg(total / sessions.length) : '0';
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <StatCard label="Total tool calls" value={String(total)} />
                    <StatCard label="Unique tools" value={String(unique)} />
                    <StatCard label="Avg per session" value={avgPerSession} />
                  </div>
                );
              })()}
              <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 space-y-2">
                {(projectStats?.toolUsage ?? []).length === 0 ? (
                  <div className="text-sm opacity-40 text-center py-6">No tool calls recorded yet.</div>
                ) : (projectStats?.toolUsage ?? []).map(item => (
                  <div key={item.tool} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-mono text-right shrink-0 truncate" style={{ color: toolColor(item.tool) }} title={item.tool}>{item.tool}</div>
                    <div className="flex-1 h-5 bg-[var(--vscode-input-background)] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${projectStats!.toolUsage[0].count > 0 ? (item.count / projectStats!.toolUsage[0].count) * 100 : 0}%`, background: toolColor(item.tool), opacity: 0.75 }} />
                    </div>
                    <div className="text-xs opacity-60 shrink-0 w-20 text-right">{item.count} ({item.percentage}%)</div>
                  </div>
                ))}
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider opacity-50 mt-4 mb-2">Recent calls</h4>
              <div className="space-y-1">
                {(projectStats?.recentToolCalls ?? []).length === 0 ? (
                  <div className="text-sm opacity-40 text-center py-6">No tool calls recorded yet.</div>
                ) : (projectStats?.recentToolCalls ?? []).map((tc, i) => <ToolCallRow key={i} tc={tc} />)}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Claude commits</h3>
              {(!claudeCommits || claudeCommits.length === 0) ? (
                <EmptyPanel title="No Claude co-authored commits found." detail="Commits show up here when git history contains a Claude co-author trailer." compact />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 mb-3">
                    <MiniStatCard label="Claude commits" value={`${claudeCommits.length}`} />
                    <MiniStatCard label="Files changed" value={`${commitFilesChanged}`} />
                    <MiniStatCard label="Most recent" value={timeAgo(claudeCommits[0].date)} />
                  </div>
                  <div className="space-y-2">
                    {claudeCommits.map(commit => <CommitRow key={commit.hash} commit={commit} />)}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ── Setup tab ── */}
        {activeTab === 'setup' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Claude guide (CLAUDE.md)</h3>
              <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]">
                {config?.claudeMd ? <MarkdownView content={config.claudeMd} /> : (
                  <div className="text-sm opacity-40 text-center py-8">No CLAUDE.md found in this project.</div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Memory</h3>
              {(!config?.memory || (memoryFiles.length === 0 && !hasMemoryIndex)) ? (
                <EmptyPanel title="No memory files found." detail="Saved project memory and working agreements appear here once Claude records them." compact />
              ) : (
                <div className="space-y-4">
                  {hasMemoryIndex && (
                    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--vscode-panel-border)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">MEMORY.md</span>
                          <span className="text-[11px] uppercase tracking-[0.16em] opacity-45">Source of Truth</span>
                        </div>
                        <p className="text-sm opacity-60 mt-2">Click any reference to open its supporting memory file.</p>
                      </div>
                      <MarkdownView content={config?.memory.index ?? ''} onLinkClick={handleMemoryLinkClick} />
                    </div>
                  )}
                  {referencedMemoryFiles.length > 0 && (
                    <MemoryReferenceList title="Referenced Files" detail="References discovered from MEMORY.md." files={referencedMemoryFiles} selectedFileName={selectedMemory?.fileName ?? null} onSelect={focusMemoryFile} />
                  )}
                  {!hasMemoryIndex && memoryFiles.length > 0 && (
                    <MemoryReferenceList title="Memory Files" detail={`${memoryFiles.length} file${memoryFiles.length !== 1 ? 's' : ''} across ${memoryTypeCount} categor${memoryTypeCount !== 1 ? 'ies' : 'y'}.`} files={memoryFiles} selectedFileName={selectedMemory?.fileName ?? null} onSelect={focusMemoryFile} />
                  )}
                  {selectedMemory && (
                    <div ref={memoryPreviewRef}>
                      <MemoryPreviewPanel memory={selectedMemory} referenced={memoryReferenceNameSet.has(normalizeMemoryFileName(selectedMemory.fileName))} />
                    </div>
                  )}
                  {hasMemoryIndex && unlinkedMemoryFiles.length > 0 && (
                    <MemoryReferenceList title="Other Memory Files" detail="Stored in memory but not linked from MEMORY.md." files={unlinkedMemoryFiles} selectedFileName={selectedMemory?.fileName ?? null} onSelect={focusMemoryFile} subdued />
                  )}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Commands</h3>
              {(!config?.commands || config.commands.length === 0) ? (
                <EmptyPanel title="No custom commands found." detail="Slash commands from .claude/commands/ appear here." compact />
              ) : (
                <div className="space-y-4">
                  {config.commands.map(cmd => <CommandBlock key={cmd.name} command={cmd} />)}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">MCP servers</h3>
              {config && Object.keys(config.mcpServers).length > 0 ? (
                <div className="space-y-2">
                  {Object.values(config.mcpServers).map(server => <McpServerRow key={server.name} server={server} />)}
                </div>
              ) : (
                <EmptyPanel title="No MCP servers configured." detail="Configured MCP integrations appear here." compact />
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Automation</h3>
              <div className="grid gap-3 sm:grid-cols-3 mb-3">
                <MiniStatCard label="Hooks" value={`${hooksCount}`} />
                <MiniStatCard label="Project Settings" value={`${projectSettingsEntries.length}`} />
                <MiniStatCard label="Automation" value={hooksCount > 0 ? 'Configured' : 'Manual'} tone={hooksCount > 0 ? 'success' : 'neutral'} />
              </div>
              {config?.hooks && config.hooks.length > 0 && (
                <div className="space-y-2 mb-3">
                  {config.hooks.map((hook, i) => <HookRow key={i} hook={hook} />)}
                </div>
              )}
              {projectSettingsEntries.length > 0 && (
                <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
                  {projectSettingsEntries.map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 border-[var(--vscode-panel-border)]">
                      <span className="text-xs font-mono font-semibold shrink-0 opacity-70">{key}</span>
                      <span className="text-xs font-mono opacity-50 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {hooksCount === 0 && projectSettingsEntries.length === 0 && (
                <EmptyPanel title="No automation configured." detail="Hooks and project-specific settings appear here." compact />
              )}
            </section>
          </div>
        )}

        {/* ── Work tab ── */}
        {activeTab === 'work' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Plans</h3>
              {plans.length === 0 ? (
                <EmptyPanel title="No plan files found." detail="Add PLAN.md or .claude/plans/*.md to surface them here." compact />
              ) : (
                <div className="space-y-4">
                  {plans.length > 1 && (
                    <PlanReferenceList files={plans} selectedFileName={selectedPlan?.fileName ?? null} onSelect={setSelectedPlanFileName} />
                  )}
                  {selectedPlan && <PlanPreviewPanel plan={selectedPlan} totalPlans={plans.length} />}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-3">Todos</h3>
              {(!projectTodos || projectTodos.length === 0) ? (
                <EmptyPanel title="No todo lists found." detail="Todo snapshots show the last recorded checklist from each session." compact />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStatCard label="Todo sessions" value={`${projectTodos.length}`} />
                    <MiniStatCard label="Completed" value={`${completedTodos}`} tone="success" />
                    <MiniStatCard label="Open items" value={`${activeTodos}`} tone={activeTodos > 0 ? 'warning' : 'neutral'} />
                  </div>
                  {projectTodos.map((snapshot, index) => (
                    <TodoSnapshotCard key={snapshot.sessionId} snapshot={snapshot} defaultExpanded={projectTodos.length === 1 || index === 0} />
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

// ── Header / session-list components ────────────────────────────────────────────

function ExportMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors inline-flex items-center gap-1.5"
      >
        Export
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 11L3 6l1.06-1.06L8 8.88l3.94-3.94L13 6z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-10 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
          {(['json', 'csv'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => { vscode.postMessage({ type: 'exportSessions', format: fmt }); setOpen(false); }}
              className="block w-full text-left text-xs px-4 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors whitespace-nowrap"
            >
              Export {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupedSessionList({ sessions, selectedId, onSelect }: { sessions: Session[]; selectedId: string | null; onSelect: (s: Session) => void }) {
  if (sessions.length === 0) {
    return <div className="text-sm opacity-40 text-center py-8">No sessions match this filter.</div>;
  }
  const groups: { label: string; items: Session[] }[] = [];
  let currentKey = '';
  for (const s of sessions) {
    const k = dayKey(s.startTime);
    if (k !== currentKey) { currentKey = k; groups.push({ label: dayLabel(s.startTime), items: [] }); }
    groups[groups.length - 1].items.push(s);
  }
  return (
    <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
      {groups.map(group => (
        <div key={group.label}>
          <div className="text-[11px] uppercase tracking-[0.16em] opacity-40 px-1 mb-1 sticky top-0 bg-[var(--vscode-editor-background)] py-1">{group.label}</div>
          <div className="space-y-1">
            {group.items.map(s => (
              <SessionListItem key={s.id} session={s} selected={selectedId === s.id} onSelect={() => onSelect(s)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionListItem({ session: s, selected, onSelect }: { session: Session; selected: boolean; onSelect: () => void }) {
  const totalCost = s.costUsd + (s.subagentCostUsd ?? 0);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg p-3 transition-colors text-sm ${selected
        ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
        : 'hover:bg-[var(--vscode-list-hoverBackground)]'}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {s.isActiveSession && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
        <span className="font-medium truncate flex-1 min-w-0">
          {s.sessionSummary ? <MentionText text={s.sessionSummary} /> : <span className="opacity-40 italic">Untitled session</span>}
        </span>
        {s.hasThinking && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="text-yellow-400 shrink-0" aria-hidden="true"><path d="M8 1l1.68 4.32L14 7l-4.32 1.68L8 13 6.32 8.68 2 7l4.32-1.68L8 1z" /></svg>
        )}
        {modelLabel(s.model) && (
          <span title={s.model ?? undefined} className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${modelBadgeColor(s.model)}`}>{modelLabel(s.model)}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs opacity-55 mt-1">
        <span>{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>·</span>
        <span>{formatDuration(s.durationMs)}</span>
        <span>·</span>
        <span>{formatTokens(s.totalTokens)}</span>
        {(s.subagentCostUsd ?? 0) > 0 && <span className="text-blue-400">+sub</span>}
        <span className="ml-auto shrink-0">{totalCost > 0 ? `est. ${formatCost(totalCost)}` : ''}</span>
      </div>
    </button>
  );
}

function QuickLink({ label, value, onClick, tone = 'neutral' }: { label: string; value: number; onClick: () => void; tone?: 'neutral' | 'warning' }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
    >
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${tone === 'warning' && value > 0 ? 'text-yellow-300' : ''}`}>{value}</div>
    </button>
  );
}

// ── Tab-specific row components ────────────────────────────────────────────────

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4" title={hint}>
      <div className="text-xs opacity-50 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function MiniStatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'text-green-300' : tone === 'warning' ? 'text-yellow-300' : 'text-[var(--vscode-editor-foreground)]';
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function EmptyPanel({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-dashed border-[var(--vscode-panel-border)] text-center ${compact ? 'px-4 py-8' : 'px-4 py-12'}`}>
      <div className="text-sm opacity-50">{title}</div>
      <div className="text-xs opacity-40 mt-2 max-w-xl mx-auto">{detail}</div>
    </div>
  );
}

function TabButton({ label, badge, active, onClick }: { label: string; badge: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-lg rounded-b-md px-3.5 py-2 text-sm border transition-colors whitespace-nowrap ${active
          ? 'border-[var(--vscode-panel-border)] border-b-transparent bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] shadow-[inset_0_-2px_0_0_var(--vscode-button-background)]'
          : 'border-transparent bg-transparent text-[var(--vscode-editor-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
        }`}
    >
      <span>{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-black/20 text-current' : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'}`}>{badge}</span>
      )}
    </button>
  );
}

function FileRow({ file }: { file: ProjectFile }) {
  const typeColor = file.type === 'created' ? 'text-green-400' : file.type === 'both' ? 'text-blue-400' : 'text-yellow-400';
  const typeLabel = file.type === 'created' ? 'created' : file.type === 'both' ? 'created+edited' : 'edited';

  return (
    <button
      onClick={() => vscode.postMessage({ type: 'openFile', path: file.fullPath })}
      className="flex items-center gap-3 w-full text-left rounded-lg border border-transparent px-3 py-3 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors"
      title={`Open ${file.fullPath}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{file.file}</span>
          <span className={`text-xs shrink-0 ${typeColor}`}>{typeLabel}</span>
        </div>
        <div className="text-xs opacity-40 truncate font-mono mt-0.5">{file.fullPath}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold">{file.editCount}×</div>
        <div className="text-xs opacity-40">{timeAgo(file.lastTouched)}</div>
      </div>
    </button>
  );
}

function McpServerRow({ server }: { server: McpServer }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm">{server.name}</span>
        {server.type && (
          <span className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded">{server.type}</span>
        )}
        {server.toolCallCount > 0 && (
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono">{server.toolCallCount} call{server.toolCallCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      {server.command && (
        <div className="text-xs opacity-60 font-mono mt-1"><span className="opacity-50">command: </span>{server.command}</div>
      )}
      {server.url && (
        <div className="text-xs opacity-60 mt-1"><span className="opacity-50">url: </span>{server.url}</div>
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
    <div className="rounded-lg border border-transparent p-2 hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-panel-border)] transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ background: toolColor(tc.tool) + '22', color: toolColor(tc.tool) }}>{tc.tool}</span>
        {hint && <span className="text-xs opacity-60 truncate font-mono" title={hint}>{hint}</span>}
        <span className="text-xs opacity-30 ml-auto shrink-0">{timeAgo(tc.timestamp || tc.sessionDate)}</span>
        {hasFullInput && (
          <button onClick={() => setOpen(o => !o)} className="text-xs opacity-40 hover:opacity-80 shrink-0 ml-1" aria-label={open ? 'Collapse' : 'Expand'}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M8 11L3 6l1.06-1.06L8 8.88l3.94-3.94L13 6z" /></svg>
          </button>
        )}
      </div>
      {open && hasFullInput && (
        <pre className="mt-1 text-xs opacity-60 font-mono whitespace-pre-wrap bg-[var(--vscode-input-background)] rounded p-2 overflow-x-auto">{JSON.stringify(tc.input, null, 2)}</pre>
      )}
    </div>
  );
}

function SubagentRow({ session, parentSessions }: { session: Session; parentSessions: Session[] }) {
  const parent = session.parentSessionId ? parentSessions.find(s => s.id === session.parentSessionId) : null;
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono shrink-0">subagent</span>
        <span className="text-xs font-medium">{new Date(session.startTime).toLocaleString([], { hour12: true })}</span>
        {session.hasThinking && <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="text-yellow-400" aria-hidden="true"><path d="M8 1l1.68 4.32L14 7l-4.32 1.68L8 13 6.32 8.68 2 7l4.32-1.68L8 1z" /></svg>}
        <span className="text-xs opacity-40 ml-auto">{formatDuration(session.durationMs)}</span>
      </div>
      {session.sessionSummary && <div className="text-xs italic opacity-60 truncate" title={session.sessionSummary}>{session.sessionSummary}</div>}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-60">
        <span>{formatTokens(session.totalTokens)} tokens</span>
        <span>{formatCost(session.costUsd)}</span>
        <span>{session.promptCount} prompt{session.promptCount !== 1 ? 's' : ''}</span>
        <span>{session.toolCallCount} tool call{session.toolCallCount !== 1 ? 's' : ''}</span>
        {session.filesModified.length > 0 && <span>{session.filesModified.length} file{session.filesModified.length !== 1 ? 's' : ''} modified</span>}
      </div>
      {parent && (
        <div className="text-xs opacity-40 mt-1">Parent: <span className="font-mono">{parent.sessionSummary?.slice(0, 60) ?? parent.id.slice(0, 8)}</span></div>
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
  if (!indexContent.trim()) { return []; }
  const markdownLinks = indexContent.matchAll(/\[[^\]]+\]\(([^)#?]+\.md)(?:#[^)]+)?\)/gi);
  for (const match of markdownLinks) { references.add(normalizeMemoryFileName(match[1])); }
  const bareFileMentions = indexContent.matchAll(/\b([A-Za-z0-9._/-]+\.md)\b/gi);
  for (const match of bareFileMentions) { references.add(normalizeMemoryFileName(match[1])); }
  references.delete('memory.md');
  return Array.from(references);
}

function getMemoryExcerpt(content: string): string {
  const flattened = content.replace(/\s+/g, ' ').trim();
  if (!flattened) { return 'No preview available.'; }
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
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] overflow-hidden">
      <button onClick={() => setCollapsed(c => !c)} className="w-full text-left px-4 py-3.5 flex items-center gap-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`shrink-0 opacity-40 transition-transform ${collapsed ? '' : 'rotate-90'}`}><path d="M6 4l4 4-4 4" /></svg>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-45">
            <span className="uppercase tracking-[0.16em]">Session</span>
            <span className="font-mono">{snapshot.sessionId.slice(0, 8)}</span>
            <span>started {startedAt}</span>
          </div>
          <div className="text-sm font-medium truncate opacity-90 mt-1">{sessionLabel}</div>
          <div className="text-xs opacity-50 mt-1">Last todo update {timeAgo(snapshot.timestamp)} • {updatedAt}</div>
          <div className="text-xs opacity-45 mt-1">
            {total} item{total !== 1 ? 's' : ''} • {completed} done{inProgress > 0 ? ` • ${inProgress} in progress` : ''}{pending > 0 ? ` • ${pending} pending` : ''}
          </div>
        </div>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${allDone ? 'text-green-400 bg-green-500/15' : 'text-yellow-400 bg-yellow-500/15'}`}>{completed}/{total}</span>
        <span className="text-xs opacity-30 shrink-0">{timeAgo(snapshot.timestamp)}</span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 border-t border-[var(--vscode-panel-border)] space-y-1.5 pt-3">
          {snapshot.todos.map((todo, i) => (
            <div key={i} className="flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 bg-[var(--vscode-editor-background)]/50">
              {todo.status === 'completed' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-green-400"><rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : todo.status === 'in_progress' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-blue-400"><rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 opacity-40"><rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" /></svg>
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
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded font-semibold">{hook.event}</span>
        {hook.matcher && <span className="text-xs opacity-50 font-mono">matcher: {hook.matcher}</span>}
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
    <div className="flex items-center gap-3 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-3 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
      <button onClick={copyHash} title={copied ? 'Copied!' : `Copy full hash: ${commit.hash}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] shrink-0 hover:opacity-80 transition-opacity">{commit.shortHash}</button>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" title={commit.subject}>{commit.subject}</div>
        <div className="text-xs opacity-45 mt-1">{commit.author}{commit.filesChanged > 0 && <span> · {commit.filesChanged} file{commit.filesChanged !== 1 ? 's' : ''}</span>}</div>
      </div>
      <span className="text-xs opacity-30 shrink-0">{timeAgo(commit.date)}</span>
    </div>
  );
}

function MemoryReferenceList({ title, detail, files, selectedFileName, onSelect, subdued = false }: {
  title: string; detail: string; files: MemoryFile[]; selectedFileName: string | null; onSelect: (fileName: string) => void; subdued?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-[var(--vscode-panel-border)] overflow-hidden ${subdued ? 'bg-[var(--vscode-editor-background)]' : 'bg-[var(--vscode-input-background)]'}`}>
      <div className="px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{title}</div>
        <p className="text-xs opacity-55 mt-1">{detail}</p>
      </div>
      <div className="p-2 space-y-1.5">
        {files.map(file => (
          <MemoryEntryButton key={file.fileName} memory={file} selected={selectedFileName === file.fileName} onSelect={() => onSelect(file.fileName)} />
        ))}
      </div>
    </div>
  );
}

function MemoryEntryButton({ memory, selected, onSelect }: { memory: MemoryFile; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${selected
      ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
      : 'border-transparent hover:border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium truncate">{memory.name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${memoryTypeColor(memory.type)}`}>{memory.type}</span>
          </div>
          {memory.description && <div className="text-xs opacity-55 mt-1 line-clamp-2">{memory.description}</div>}
          <div className="text-xs opacity-45 font-mono mt-1">{memory.fileName}</div>
          <div className="text-xs opacity-55 mt-2 leading-relaxed">{getMemoryExcerpt(memory.content)}</div>
        </div>
      </div>
    </button>
  );
}

function MemoryPreviewPanel({ memory, referenced }: { memory: MemoryFile; referenced: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
      <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${memoryTypeColor(memory.type)}`}>{memory.type}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${referenced ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{referenced ? 'Referenced In MEMORY.md' : 'Not Linked From MEMORY.md'}</span>
        </div>
        <h3 className="text-base font-semibold mt-3">{memory.name}</h3>
        {memory.description && <p className="text-sm opacity-60 mt-1">{memory.description}</p>}
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

function PlanReferenceList({ files, selectedFileName, onSelect }: { files: PlanFile[]; selectedFileName: string | null; onSelect: (fileName: string) => void }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">Plans</div>
        <p className="text-xs opacity-55 mt-1">Choose a saved plan to preview its roadmap or execution notes.</p>
      </div>
      <div className="p-2 space-y-1.5">
        {files.map(file => (
          <button key={file.fileName} onClick={() => onSelect(file.fileName)} className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${selectedFileName === file.fileName
            ? 'border-[var(--vscode-button-background)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
            : 'border-transparent hover:border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]'}`}>
            <div className="text-sm font-medium">{file.name}</div>
            {file.description && <div className="text-xs opacity-55 mt-1 line-clamp-2">{file.description}</div>}
            <div className="text-xs font-mono opacity-45 mt-1">{file.fileName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanPreviewPanel({ plan, totalPlans }: { plan: PlanFile; totalPlans: number }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
      <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Plan File</span>
          <span className="text-[11px] uppercase tracking-[0.16em] opacity-45">{totalPlans} saved plan{totalPlans !== 1 ? 's' : ''}</span>
        </div>
        <h3 className="text-base font-semibold mt-3">{plan.name}</h3>
        {plan.description && <p className="text-sm opacity-60 mt-1">{plan.description}</p>}
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
