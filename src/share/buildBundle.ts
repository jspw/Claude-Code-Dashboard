import type { Project, ProjectConfig, Session } from '../store/DashboardStore';
import type { BundleFile, TranscriptEntry } from './types';
import { AGENTS_FILE, INDEX_FILE, SESSIONS_DIR } from './types';
import { slugify } from './markdown';
import { renderAgentsMd } from './renderAgentsMd';
import { renderTranscript, sessionFiles } from './renderTranscript';
import { renderIndex } from './renderIndex';

function transcriptFileName(session: Session, taken: Set<string>): string {
  const date = new Date(session.startTime).toISOString().slice(0, 10);
  const slug = slugify(session.sessionSummary ?? '') || session.id.slice(0, 8);

  let candidate = `${date}-${slug}`;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${date}-${slug}-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return `${candidate}.md`;
}

/**
 * Assembles every file in a project context bundle.
 *
 * Only whole-project sharing produces files; a single session is copied to the
 * clipboard instead, so a bundle always describes the full project and the index
 * always covers every transcript beside it.
 */
export function buildBundle(
  project: Project,
  config: ProjectConfig,
  sessions: Session[],
  generatedAt: Date = new Date()
): BundleFile[] {
  const ordered = [...sessions].sort((a, b) => b.startTime - a.startTime);

  const taken = new Set<string>();
  const entries: TranscriptEntry[] = ordered.map(session => ({
    sessionId: session.id,
    startTime: session.startTime,
    summary: session.sessionSummary,
    files: sessionFiles(session, project.path),
    fileName: transcriptFileName(session, taken),
  }));

  const files: BundleFile[] = [
    {
      relativePath: AGENTS_FILE,
      content: renderAgentsMd(project, config, ordered.length, generatedAt),
    },
  ];

  ordered.forEach((session, i) => {
    files.push({
      relativePath: `${SESSIONS_DIR}/${entries[i].fileName}`,
      content: renderTranscript(session, project.path),
    });
  });

  if (entries.length > 0) {
    files.push({ relativePath: INDEX_FILE, content: renderIndex(entries) });
  }

  return files;
}
