import { DashboardStore, Project, Session } from '../../store/DashboardStore';

type StoreInternals = {
  projects: Map<string, Project>;
  sessions: Map<string, Session[]>;
  subagentSessions: Map<string, Session[]>;
};

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
  const internals = store as unknown as StoreInternals;

  // Inject data via internal maps
  const projectsMap = internals.projects;
  const sessionsMap = internals.sessions;
  const subagentsMap = internals.subagentSessions;

  for (const project of projects) {
    projectsMap.set(project.id, project);
    sessionsMap.set(project.id, sessionsByProject[project.id] ?? []);
    subagentsMap.set(project.id, subagentsByProject[project.id] ?? []);
  }

  return store;
}
