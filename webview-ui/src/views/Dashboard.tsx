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
import UsageLineChart from '../components/UsageLineChart';
import ProjectBarChart from '../components/ProjectBarChart';
import HeatmapGrid from '../components/HeatmapGrid';
import PatternChart from '../components/PatternChart';
import ToolUsageBar from '../components/ToolUsageBar';
import HotFilesList from '../components/HotFilesList';
import EfficiencyCards from '../components/EfficiencyCards';
import RecentChanges from '../components/RecentChanges';
import ProductivityChart from '../components/ProductivityChart';

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
}

type Tab = 'overview' | 'charts' | 'insights';

function formatTokens(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}k`; }
  return String(n);
}

function timeAgo(ts: number): string {
  if (!ts) { return 'never'; }
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) { return 'just now'; }
  if (h < 24) { return `${h}h ago`; }
  return `${d}d ago`;
}

const TAB_LABELS: Array<{ key: Tab; label: string; description: string }> = [
  { key: 'overview', label: 'Overview', description: 'Track active projects, weekly momentum, and recent portfolio activity.' },
  { key: 'charts', label: 'Charts', description: 'Review usage and cost trends across the month.' },
  { key: 'insights', label: 'Insights', description: 'Explore patterns, productivity, and hotspots across your work.' },
];

type SortKey = 'lastActive' | 'cost' | 'sessions';

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
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [projectFilter, setProjectFilter] = useState('');
  const [projectSort, setProjectSort] = useState<SortKey>('lastActive');

  const active = projects.filter(p => p.isActive);
  const activeTabMeta = TAB_LABELS.find(tab => tab.key === activeTab) ?? TAB_LABELS[0];

  const filteredProjects = projects
    .filter(p => !p.isActive)
    .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
    .sort((a, b) => {
      if (projectSort === 'cost') { return b.totalCostUsd - a.totalCostUsd; }
      if (projectSort === 'sessions') { return b.sessionCount - a.sessionCount; }
      return b.lastActive - a.lastActive;
    })
    .slice(0, 20);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-45">Workspace</div>
            <h1 className="text-2xl font-bold mt-1">Claude Code Dashboard</h1>
            <p className="text-sm opacity-60 mt-1">{stats?.totalProjects ?? 0} projects · {stats?.activeSessionCount ?? 0} active sessions</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {formatTokens(stats?.tokensTodayTotal ?? 0)} today
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
              est. ${((stats?.costTodayUsd ?? 0)).toFixed(3)}
            </span>
          </div>
        </div>
        <p className="text-xs opacity-45 mt-3">
          Token usage comes from local Claude session logs. Costs are estimated from detected model pricing and may differ from Anthropic's actual billing.
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] overflow-hidden">
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

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Budget alert banner */}
          {budgetStatus && budgetStatus.pct >= 0.8 && (
            <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
              budgetStatus.pct >= 1.0
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
            }`}>
              <span className="text-base">{budgetStatus.pct >= 1.0 ? '🚨' : '⚠️'}</span>
              <div>
                <span className="font-semibold">
                  {budgetStatus.pct >= 1.0 ? 'Monthly budget exceeded' : 'Monthly budget 80% used'}
                </span>
                <span className="ml-2 opacity-80">
                  ${budgetStatus.spentUsd.toFixed(2)} of ${budgetStatus.budgetUsd.toFixed(2)} ({Math.round(budgetStatus.pct * 100)}%)
                </span>
              </div>
            </div>
          )}

          {/* Weekly Recap card */}
          {weeklyRecap && (
            <div className="rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Weekly Recap</div>
                  <div className="text-sm font-medium">
                    {weeklyRecap.sessions} sessions &middot; {weeklyRecap.projects} projects &middot; {formatTokens(weeklyRecap.tokens)} tokens &middot; ${weeklyRecap.costUsd.toFixed(2)} &middot; {weeklyRecap.filesModified} files modified
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

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tokens today" value={formatTokens(stats?.tokensTodayTotal ?? 0)} />
            <StatCard label="Est. cost today" value={`$${(stats?.costTodayUsd ?? 0).toFixed(3)}`} />
            <StatCard label="Tokens this week" value={formatTokens(stats?.tokensWeekTotal ?? 0)} />
            <StatCard label="Est. cost this week" value={`$${(stats?.costWeekUsd ?? 0).toFixed(2)}`} />
          </div>

          {/* Active sessions */}
          {active.length > 0 && (
            <DashboardSection
              eyebrow="Overview"
              title="Active Now"
              detail="Projects with a currently running Claude session."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map(p => (
                  <ActiveProjectCard key={p.id} project={p} />
                ))}
              </div>
            </DashboardSection>
          )}

          {/* All projects with filter/sort */}
          <DashboardSection
            eyebrow="Library"
            title="Projects"
            detail="Browse recent repositories and jump into their detail views."
          >
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
                : <div className="text-xs opacity-40 py-4 text-center">No projects match "{projectFilter}"</div>
              }
            </div>
          </DashboardSection>
        </div>
      )}

      {/* Charts tab */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          <DashboardSection eyebrow="Charts" title="Token Usage — Last 30 Days">
              {usageOverTime && usageOverTime.length > 0
                ? <UsageLineChart data={usageOverTime} />
                : <div className="text-sm opacity-40 text-center py-8">No usage data available.</div>
              }
          </DashboardSection>

          <DashboardSection eyebrow="Charts" title="Token Usage by Project">
              {usageByProject && usageByProject.length > 0
                ? <ProjectBarChart data={usageByProject} />
                : <div className="text-sm opacity-40 text-center py-8">No project usage data available.</div>
              }
          </DashboardSection>

          {/* Projected Monthly Cost */}
          {projectedCost && (
            <DashboardSection eyebrow="Forecast" title="Projected Monthly Cost">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs opacity-50 mb-1">This month so far</div>
                    <div className="text-xl font-bold">${projectedCost.currentMonthCost.toFixed(2)}</div>
                    <div className="text-xs opacity-40 mt-0.5">{projectedCost.daysElapsed} days elapsed</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-50 mb-1">Daily average</div>
                    <div className="text-xl font-bold">${projectedCost.dailyAvgCost.toFixed(3)}</div>
                    <div className="text-xs opacity-40 mt-0.5">{projectedCost.daysRemaining} days remaining</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-50 mb-1">Projected total</div>
                    <div className="text-xl font-bold">${projectedCost.projectedMonthCost.toFixed(2)}</div>
                    <div className="text-xs opacity-40 mt-0.5">end of month estimate</div>
                  </div>
                </div>

                {/* Progress bar */}
                {projectedCost.projectedMonthCost > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs opacity-50 mb-1">
                      <span>$0</span>
                      <span>${projectedCost.projectedMonthCost.toFixed(2)} projected</span>
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

          {/* Cost by Project This Month */}
          {usageByProject && usageByProject.length > 0 && (
            <DashboardSection eyebrow="Forecast" title="Cost by Project This Month">
              <div className="space-y-2">
                {(() => {
                  const maxCost = Math.max(...usageByProject.map(p => p.costUsd), 0.0001);
                  return usageByProject.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-28 text-xs truncate opacity-70 shrink-0 text-right" title={p.name}>{p.name}</div>
                      <div className="flex-1 h-4 bg-[var(--vscode-input-background)] rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(p.costUsd / maxCost) * 100}%`,
                            background: 'var(--vscode-button-background)',
                            opacity: 0.75,
                          }}
                        />
                      </div>
                      <div className="text-xs opacity-60 shrink-0 w-16 text-right">${p.costUsd.toFixed(3)}</div>
                    </div>
                  ));
                })()}
              </div>
            </DashboardSection>
          )}
        </div>
      )}

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <DashboardSection eyebrow="Insights" title="Prompt Categories">
              {promptPatterns
                ? <PatternChart data={promptPatterns} />
                : <div className="text-sm opacity-40 text-center py-8">No prompt data yet.</div>
              }
          </DashboardSection>

          <DashboardSection eyebrow="Insights" title="Usage Heatmap (by Hour & Day)">
              {heatmapData && heatmapData.length > 0
                ? <HeatmapGrid data={heatmapData} />
                : <div className="text-sm opacity-40 text-center py-8">No heatmap data available.</div>
              }
          </DashboardSection>

          {/* Efficiency Stats */}
          {efficiency && (
            <DashboardSection eyebrow="Insights" title="Efficiency Stats">
              <EfficiencyCards data={efficiency} />
            </DashboardSection>
          )}

          {/* Tool Usage */}
          <DashboardSection eyebrow="Insights" title="Tool Usage">
              <ToolUsageBar data={toolUsage ?? []} />
          </DashboardSection>

          {/* Productivity by Hour */}
          <DashboardSection eyebrow="Insights" title="Productivity by Hour">
              <ProductivityChart data={productivityByHour ?? []} />
          </DashboardSection>

          {/* Hot Files */}
          <DashboardSection eyebrow="Insights" title="Hot Files">
              <HotFilesList data={hotFiles ?? []} />
          </DashboardSection>

          {/* Recent File Changes */}
          <DashboardSection eyebrow="Insights" title="Recent File Changes (last 7 days)">
              <RecentChanges data={recentChanges ?? []} />
          </DashboardSection>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActiveProjectCard({ project }: { project: Project }) {
  return (
    <button
      onClick={() => vscode.postMessage({ type: 'openProject', projectId: project.id })}
      className="text-left rounded-xl border border-green-500/35 bg-green-500/5 p-4 hover:bg-green-500/10 transition-colors w-full"
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
      className="flex items-center gap-3 w-full text-left rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)] px-4 py-3 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
    >
      <span className="font-medium min-w-0 flex-1 truncate">{project.name}</span>
      <span className="text-xs opacity-50 shrink-0">{timeAgo(project.lastActive)}</span>
      <span className="text-xs opacity-50 shrink-0">{formatTokens(project.totalTokens)}</span>
      <span className="text-xs opacity-50 shrink-0">${project.totalCostUsd.toFixed(3)}</span>
    </button>
  );
}

function DashboardTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
    </button>
  );
}

function DashboardSection({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 sm:p-5">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] opacity-45">{eyebrow}</div>
        <h2 className="text-xl font-semibold mt-1">{title}</h2>
        {detail && (
          <p className="text-sm opacity-60 mt-1 max-w-2xl">{detail}</p>
        )}
      </div>
      {children}
    </section>
  );
}
