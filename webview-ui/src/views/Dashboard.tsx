import React, { useState } from 'react';
import {
  Project,
  DashboardStats,
  DailyUsage,
  ProjectUsage,
  HeatmapCell,
  PatternCount,
  ToolUsageStat,
  HotFile,
  ProjectedCost,
  StreakData,
  EfficiencyStats,
  WeeklyRecap,
  RecentFileChange,
  ProductivityHour,
  BudgetStatus,
} from '../types';
import { vscode } from '../vscode';
import { formatTokens, formatCost, timeAgo, COST_DISCLAIMER } from '../utils/format';
import UsageLineChart from '../components/UsageLineChart';
import ProjectBarChart from '../components/ProjectBarChart';
import HeatmapGrid from '../components/HeatmapGrid';
import PatternChart from '../components/PatternChart';
import ToolUsageBar from '../components/ToolUsageBar';
import HotFilesList from '../components/HotFilesList';
import EfficiencyCards from '../components/EfficiencyCards';
import RecentChanges from '../components/RecentChanges';
import ProductivityChart from '../components/ProductivityChart';
import SessionsBrowser from '../components/SessionsBrowser';

interface Props {
  projects: Project[];
  stats: DashboardStats;
  usageOverTime?: DailyUsage[];
  usageByProject?: ProjectUsage[];
  heatmapData?: HeatmapCell[];
  promptPatterns?: PatternCount[];
  toolUsage?: ToolUsageStat[];
  hotFiles?: HotFile[];
  projectedCost?: ProjectedCost;
  streak?: StreakData;
  efficiency?: EfficiencyStats;
  weeklyRecap?: WeeklyRecap;
  recentChanges?: RecentFileChange[];
  productivityByHour?: ProductivityHour[];
  budgetStatus?: BudgetStatus | null;
  showTour?: boolean;
}

type Tab = 'home' | 'analytics' | 'sessions';
type RangeKey = 7 | 30 | 90;

const TAB_LABELS: Array<{ key: Tab; label: string; description: string }> = [
  { key: 'home', label: 'Home', description: 'Today at a glance — live activity, budget, and your projects.' },
  { key: 'analytics', label: 'Analytics', description: 'Spend, patterns, tools, and efficiency over time.' },
  { key: 'sessions', label: 'Sessions', description: 'Browse and search every session across all projects.' },
];

type SortKey = 'lastActive' | 'cost' | 'sessions';

// ── ⓘ tooltip carrying the single cost disclaimer ──────────────────────────────
function InfoDot({ label }: { label: string }) {
  return (
    <span
      title={label}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current opacity-40 text-[9px] font-semibold cursor-help align-middle ml-1"
      aria-label={label}
    >
      i
    </span>
  );
}

export default function Dashboard({
  projects,
  stats,
  usageOverTime,
  usageByProject,
  heatmapData,
  promptPatterns,
  toolUsage,
  hotFiles,
  projectedCost,
  streak,
  efficiency,
  weeklyRecap,
  recentChanges,
  productivityByHour,
  budgetStatus,
  showTour,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [projectFilter, setProjectFilter] = useState('');
  const [projectSort, setProjectSort] = useState<SortKey>('lastActive');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [range, setRange] = useState<RangeKey>(30);

  const active = projects.filter(p => p.isActive);
  const activeTabMeta = TAB_LABELS.find(tab => tab.key === activeTab) ?? TAB_LABELS[0];

  const allInactive = projects
    .filter(p => !p.isActive)
    .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
    .sort((a, b) => {
      if (projectSort === 'cost') { return b.totalCostUsd - a.totalCostUsd; }
      if (projectSort === 'sessions') { return b.sessionCount - a.sessionCount; }
      return b.lastActive - a.lastActive;
    });
  const PROJECT_CAP = 20;
  const filteredProjects = showAllProjects ? allInactive : allInactive.slice(0, PROJECT_CAP);

  const hasData = projects.length > 0 || (stats?.totalProjects ?? 0) > 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Claude Code Dashboard</h1>
            <p className="text-sm opacity-60 mt-1">{stats?.totalProjects ?? 0} projects · {stats?.activeSessionCount ?? 0} active sessions</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {formatTokens(stats?.tokensTodayTotal ?? 0)} today
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
              est. {formatCost(stats?.costTodayUsd ?? 0)}
              <InfoDot label={COST_DISCLAIMER} />
            </span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--vscode-panel-border)]">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {TAB_LABELS.map(({ key, label }) => (
              <DashboardTabButton
                key={key}
                label={label}
                active={activeTab === key}
                onClick={() => setActiveTab(key)}
              />
            ))}
          </div>
          <p className="text-sm opacity-60 mt-3 max-w-2xl">{activeTabMeta.description}</p>
        </div>
      </nav>

      {/* ── Home tab ── */}
      {activeTab === 'home' && (
        <div className="space-y-6">
          {!hasData && <EmptyState />}

          {showTour && hasData && <TourStrip />}

          {/* Budget banner (>=80%) */}
          {budgetStatus && budgetStatus.pct >= 0.8 && (
            <BudgetBanner budgetStatus={budgetStatus} />
          )}

          {hasData && (
            <>
              {/* Budget progress (whenever a budget exists) */}
              {budgetStatus && budgetStatus.pct < 0.8 && (
                <BudgetProgress budgetStatus={budgetStatus} />
              )}
              {!budgetStatus && (
                <button
                  onClick={() => vscode.postMessage({ type: 'setBudget' })}
                  className="text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
                >
                  Set a monthly budget
                </button>
              )}

              {/* Stats strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Tokens today" value={formatTokens(stats?.tokensTodayTotal ?? 0)} />
                <StatCard label="Est. cost today" value={formatCost(stats?.costTodayUsd ?? 0)} />
                <StatCard label="Tokens this week" value={formatTokens(stats?.tokensWeekTotal ?? 0)} />
                <StatCard label="Est. cost this week" value={formatCost(stats?.costWeekUsd ?? 0)} />
              </div>

              {/* Weekly recap */}
              {weeklyRecap && (
                <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">This week</div>
                      <div className="text-sm font-medium">
                        {weeklyRecap.sessions} sessions &middot; {weeklyRecap.projects} projects &middot; {formatTokens(weeklyRecap.tokens)} tokens &middot; est. {formatCost(weeklyRecap.costUsd)} &middot; {weeklyRecap.filesModified} files modified
                      </div>
                      {weeklyRecap.topProject && (
                        <div className="text-xs opacity-60 mt-1">
                          Top project: <span className="font-semibold opacity-90">{weeklyRecap.topProject}</span>
                          {weeklyRecap.topProjectTokens > 0 && ` (${formatTokens(weeklyRecap.topProjectTokens)} tokens)`}
                        </div>
                      )}
                    </div>
                    {streak && streak.currentStreak > 0 && (
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-bold">{streak.currentStreak}</div>
                        <div className="text-xs opacity-60">day streak</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active sessions */}
              {active.length > 0 && (
                <DashboardSection title="Active now" detail="Projects with a currently running Claude session.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {active.map(p => (
                      <ActiveProjectCard key={p.id} project={p} />
                    ))}
                  </div>
                </DashboardSection>
              )}

              {/* Projects */}
              <DashboardSection title="Projects" detail="Browse recent repositories and jump into their detail views.">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="ml-auto flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter by name…"
                      value={projectFilter}
                      onChange={e => setProjectFilter(e.target.value)}
                      className="text-xs px-2 py-1 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] w-40 focus:outline-none"
                    />
                    <select
                      value={projectSort}
                      onChange={e => setProjectSort(e.target.value as SortKey)}
                      className="text-xs px-2 py-1 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] focus:outline-none"
                    >
                      <option value="lastActive">Last active</option>
                      <option value="cost">Cost</option>
                      <option value="sessions">Sessions</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredProjects.length > 0
                    ? filteredProjects.map(p => <ProjectRow key={p.id} project={p} />)
                    : <div className="text-xs opacity-40 py-4 text-center">No projects match &ldquo;{projectFilter}&rdquo;</div>
                  }
                </div>
                {allInactive.length > PROJECT_CAP && (
                  <button
                    onClick={() => setShowAllProjects(s => !s)}
                    className="mt-3 text-xs opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {showAllProjects ? 'Show fewer' : `Show all ${allInactive.length}`}
                  </button>
                )}
              </DashboardSection>
            </>
          )}
        </div>
      )}

      {/* ── Analytics tab ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Time range control */}
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-50">Range:</span>
            <div className="flex rounded-lg overflow-hidden border border-[var(--vscode-panel-border)] text-xs">
              {([7, 30, 90] as RangeKey[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 transition-colors ${range === r ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'opacity-60 hover:opacity-100'}`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {/* Spend */}
          <DashboardSection title={`Token Usage — Last ${range} Days`}>
            {usageOverTime && usageOverTime.length > 0
              ? <UsageLineChart data={usageOverTime.slice(-range)} />
              : <div className="text-sm opacity-40 text-center py-8">No usage data available.</div>
            }
          </DashboardSection>

          <DashboardSection title="Token Usage by Project">
            {usageByProject && usageByProject.length > 0
              ? <ProjectBarChart data={usageByProject} />
              : <div className="text-sm opacity-40 text-center py-8">No project usage data available.</div>
            }
          </DashboardSection>

          {projectedCost && (
            <DashboardSection title="Projected Monthly Cost">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs opacity-50 mb-1">This month so far</div>
                  <div className="text-xl font-bold">{formatCost(projectedCost.currentMonthCost)}</div>
                  <div className="text-xs opacity-40 mt-0.5">{projectedCost.daysElapsed} days elapsed</div>
                </div>
                <div>
                  <div className="text-xs opacity-50 mb-1">Daily average</div>
                  <div className="text-xl font-bold">{formatCost(projectedCost.dailyAvgCost)}</div>
                  <div className="text-xs opacity-40 mt-0.5">{projectedCost.daysRemaining} days remaining</div>
                </div>
                <div>
                  <div className="text-xs opacity-50 mb-1">Projected total</div>
                  <div className="text-xl font-bold">{formatCost(projectedCost.projectedMonthCost)}</div>
                  <div className="text-xs opacity-40 mt-0.5">end of month estimate</div>
                </div>
              </div>
              {projectedCost.projectedMonthCost > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs opacity-50 mb-1">
                    <span>{formatCost(0)}</span>
                    <span>{formatCost(projectedCost.projectedMonthCost)} projected</span>
                  </div>
                  <div className="h-2 bg-[var(--vscode-input-background)] rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min(100, (projectedCost.currentMonthCost / projectedCost.projectedMonthCost) * 100)}%`,
                        background: 'var(--vscode-button-background)',
                      }}
                    />
                  </div>
                </div>
              )}
            </DashboardSection>
          )}

          {/* Patterns */}
          <DashboardSection title="Prompt Categories">
            {promptPatterns
              ? <PatternChart data={promptPatterns} />
              : <div className="text-sm opacity-40 text-center py-8">No prompt data yet.</div>
            }
          </DashboardSection>

          <DashboardSection title="Usage Heatmap (by Hour & Day)">
            {heatmapData && heatmapData.length > 0
              ? <HeatmapGrid data={heatmapData} />
              : <div className="text-sm opacity-40 text-center py-8">No heatmap data available.</div>
            }
          </DashboardSection>

          <DashboardSection title="Productivity by Hour">
            <ProductivityChart data={productivityByHour ?? []} />
          </DashboardSection>

          {/* Efficiency */}
          {efficiency && (
            <DashboardSection title="Efficiency Stats">
              <EfficiencyCards data={efficiency} />
            </DashboardSection>
          )}

          {/* Tools & Files */}
          <DashboardSection title="Tool Usage">
            <ToolUsageBar data={toolUsage ?? []} />
          </DashboardSection>

          <DashboardSection title="Hot Files">
            <HotFilesList data={hotFiles ?? []} />
          </DashboardSection>

          <DashboardSection title="Recent File Changes (last 7 days)">
            <RecentChanges data={recentChanges ?? []} />
          </DashboardSection>
        </div>
      )}

      {/* ── Sessions tab ── */}
      {activeTab === 'sessions' && (
        <DashboardSection title="All Sessions" detail="Every session across your projects. Search prompts or filter by project, model, and cost.">
          <SessionsBrowser />
        </DashboardSection>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--vscode-panel-border)] px-6 py-12 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto opacity-30 mb-4" aria-hidden="true">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="text-lg font-semibold">No Claude sessions found yet</h2>
      <p className="text-sm opacity-60 mt-2 max-w-md mx-auto">
        This dashboard reads session logs from <span className="font-mono text-xs">~/.claude/projects/</span> locally.
        Run a Claude Code session in any project and it will appear here automatically — nothing leaves your machine.
      </p>
      <button
        onClick={() => vscode.postMessage({ type: 'refresh' })}
        className="mt-4 text-xs px-3 py-1.5 rounded border border-[var(--vscode-button-background)] text-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-background)] hover:text-[var(--vscode-button-foreground)] transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}

function TourStrip() {
  const cards = [
    { title: 'Local & private', body: 'Everything is read from ~/.claude on your machine. No network calls, no telemetry, no API key.' },
    { title: 'Costs are estimates', body: 'Spend is computed from token logs and a static pricing table. It approximates, not matches, Anthropic billing.' },
    { title: 'Enable live tracking', body: 'Turn on hooks (command palette → “Enable Live Tracking”) to see what Claude is doing in real time.' },
  ];
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Welcome</span>
        <button
          onClick={() => vscode.postMessage({ type: 'dismissTour' })}
          className="ml-auto text-xs opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Dismiss welcome"
        >
          Dismiss
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(c => (
          <div key={c.title} className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3">
            <div className="text-sm font-medium">{c.title}</div>
            <div className="text-xs opacity-60 mt-1 leading-relaxed">{c.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetBanner({ budgetStatus }: { budgetStatus: BudgetStatus }) {
  const exceeded = budgetStatus.pct >= 1.0;
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
      exceeded ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
    }`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0" aria-hidden="true">
        <path d="M8 1.5l6.5 11.5a.75.75 0 01-.65 1.12H2.15a.75.75 0 01-.65-1.12L8 1.5zM8 6a.75.75 0 00-.75.75v3a.75.75 0 001.5 0v-3A.75.75 0 008 6zm0 6.5a.9.9 0 100-1.8.9.9 0 000 1.8z" />
      </svg>
      <div>
        <span className="font-semibold">{exceeded ? 'Monthly budget exceeded' : 'Monthly budget 80% used'}</span>
        <span className="ml-2 opacity-80">
          {formatCost(budgetStatus.spentUsd)} of {formatCost(budgetStatus.budgetUsd)} ({Math.round(budgetStatus.pct * 100)}%)
        </span>
      </div>
      <button
        onClick={() => vscode.postMessage({ type: 'setBudget' })}
        className="ml-auto text-xs opacity-70 hover:opacity-100 transition-opacity underline"
      >
        Adjust
      </button>
    </div>
  );
}

function BudgetProgress({ budgetStatus }: { budgetStatus: BudgetStatus }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-50">Monthly budget</span>
        <button
          onClick={() => vscode.postMessage({ type: 'setBudget' })}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity"
        >
          Adjust
        </button>
      </div>
      <div className="flex justify-between text-xs opacity-60 mb-1">
        <span>{formatCost(budgetStatus.spentUsd)} spent</span>
        <span>{formatCost(budgetStatus.budgetUsd)} budget</span>
      </div>
      <div className="h-2 bg-[var(--vscode-input-background)] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${Math.min(100, budgetStatus.pct * 100)}%`, background: 'var(--vscode-button-background)' }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActiveProjectCard({ project }: { project: Project }) {
  return (
    <button
      onClick={() => vscode.postMessage({ type: 'openProject', projectId: project.id })}
      className="text-left rounded-lg border border-green-500/35 bg-green-500/5 p-4 hover:bg-green-500/10 transition-colors w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-semibold">{project.name}</span>
        <span className="ml-auto text-xs opacity-50">live</span>
      </div>
      <div className="text-xs opacity-60 truncate">{project.path}</div>
      <div className="mt-2 flex gap-3 text-xs">
        <span>{formatTokens(project.totalTokens)} tokens</span>
        <span>{project.sessionCount} sessions</span>
      </div>
    </button>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <button
      onClick={() => vscode.postMessage({ type: 'openProject', projectId: project.id })}
      className="flex items-center gap-3 w-full text-left rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
    >
      <span className="font-medium min-w-0 flex-1 truncate">{project.name}</span>
      <span className="text-xs opacity-50 shrink-0">{timeAgo(project.lastActive)}</span>
      <span className="text-xs opacity-50 shrink-0">{formatTokens(project.totalTokens)}</span>
      <span className="text-xs opacity-50 shrink-0">{formatCost(project.totalCostUsd)}</span>
    </button>
  );
}

function DashboardTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-lg rounded-b-md px-3.5 py-2 text-sm border transition-colors whitespace-nowrap ${
        active
          ? 'border-[var(--vscode-panel-border)] border-b-transparent bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] shadow-[inset_0_-2px_0_0_var(--vscode-button-background)]'
          : 'border-transparent bg-transparent text-[var(--vscode-editor-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      <span>{label}</span>
    </button>
  );
}

function DashboardSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {detail && (
          <p className="text-sm opacity-60 mt-1 max-w-2xl">{detail}</p>
        )}
      </div>
      {children}
    </section>
  );
}
