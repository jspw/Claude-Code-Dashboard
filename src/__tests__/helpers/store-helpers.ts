import { DashboardStore, Project, Session } from '../../store/DashboardStore';

/**
 * Creates a DashboardStore and injects project/session data directly
 * (bypasses filesystem scanning for unit tests).
 */
export function createPopulatedStore(
  projects: Project[],
  sessionsByProject: Record<string, Session[]>,
  subagentsByProject: Record<string, Session[]> = {},
): DashboardStore {
  const store = new DashboardStore('/tmp/fake-claude-dir');

  // Inject data via internal maps
  const projectsMap = (store as any).projects as Map<string, Project>;
  const sessionsMap = (store as any).sessions as Map<string, Session[]>;
  const subagentsMap = (store as any).subagentSessions as Map<string, Session[]>;

  for (const project of projects) {
    projectsMap.set(project.id, project);
    sessionsMap.set(project.id, sessionsByProject[project.id] ?? []);
    subagentsMap.set(project.id, subagentsByProject[project.id] ?? []);
  }

  return store;
}
