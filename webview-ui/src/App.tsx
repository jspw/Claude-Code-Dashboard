import React, { useState, useEffect } from 'react';
import Dashboard from './views/Dashboard';
import ProjectDetail from './views/ProjectDetail';
import Sidebar from './views/Sidebar';
import {
  Project, Session, ProjectConfig,
  DashboardStats, DailyUsage, ProjectUsage, HeatmapCell,
  PatternCount, ToolUsageStat, HotFile,
  ProjectedCost, StreakData, EfficiencyStats, WeeklyRecap,
  RecentFileChange, ProductivityHour, BudgetStatus,
  ProjectStats, ProjectFile,
} from './types';

declare global {
  interface Window {
    __INITIAL_VIEW__: 'dashboard' | 'project' | 'sidebar';
    __INITIAL_DATA__: unknown;
  }
}

export default function App() {
  const view = window.__INITIAL_VIEW__ ?? 'dashboard';
  const [data, setData] = useState<unknown>(window.__INITIAL_DATA__);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'stateUpdate' || msg.type === 'liveEvent') {
        setData((prev: unknown) => ({ ...(prev as object), ...msg.payload }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (view === 'sidebar') {
    const { projects, stats } = data as { projects: Project[]; stats: DashboardStats };
    return <Sidebar projects={projects ?? []} stats={stats} />;
  }

  if (view === 'project') {
    const { project, sessions, subagentSessions, config, projectStats, projectFiles } = data as {
      project: Project;
      sessions: Session[];
      subagentSessions?: Session[];
      config?: ProjectConfig;
      projectStats?: ProjectStats;
      projectFiles?: ProjectFile[];
    };
    return <ProjectDetail project={project} sessions={sessions} subagentSessions={subagentSessions} config={config} projectStats={projectStats} projectFiles={projectFiles} />;
  }

  const {
    projects, stats, usageOverTime, usageByProject, heatmapData,
    promptPatterns, toolUsage, hotFiles, projectedCost,
    streak, efficiency, weeklyRecap, recentChanges, productivityByHour,
    budgetStatus,
  } = data as {
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
  };

  return (
    <Dashboard
      projects={projects ?? []}
      stats={stats}
      usageOverTime={usageOverTime}
      usageByProject={usageByProject}
      heatmapData={heatmapData}
      promptPatterns={promptPatterns}
      toolUsage={toolUsage}
      hotFiles={hotFiles}
      projectedCost={projectedCost}
      streak={streak}
      efficiency={efficiency}
      weeklyRecap={weeklyRecap}
      recentChanges={recentChanges}
      productivityByHour={productivityByHour}
      budgetStatus={budgetStatus}
    />
  );
}
