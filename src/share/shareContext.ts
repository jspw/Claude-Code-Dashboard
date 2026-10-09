import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import type { DashboardStore, Project } from '../store/DashboardStore';
import type { ShareScope } from './types';
import { AGENTS_FILE, CONTEXT_DIR, GENERATED_MARKER } from './types';
import { buildBundle } from './buildBundle';
import { redactHome } from './markdown';
import { estimateTokens, renderHandoff } from './renderHandoff';
import { readTextFile, writeBundle } from './writeBundle';

// Past this, a single chat message is an unrealistic way to move the text.
const LARGE_TOKEN_ESTIMATE = 25_000;

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`;
}

/**
 * Copies one session to the clipboard as chat-ready text.
 *
 * Nothing is written to disk. Sharing a single session assumes the other agent
 * already knows the project — the missing piece is just the conversation, and the
 * natural way to hand that over is to paste it.
 */
async function shareSession(store: DashboardStore, project: Project, sessionId: string | undefined, homeDir: string): Promise<void> {
  const session = store.getSessions(project.id).find(candidate => candidate.id === sessionId);
  if (!session) {
    vscode.window.showWarningMessage('That session is no longer available.');
    return;
  }

  const text = redactHome(renderHandoff(project, session), homeDir);
  await vscode.env.clipboard.writeText(text);

  const tokens = estimateTokens(text);
  const summary = `Session copied to clipboard (~${formatTokens(tokens)} tokens). Paste it into the other agent's chat.`;

  const action = tokens > LARGE_TOKEN_ESTIMATE
    ? await vscode.window.showWarningMessage(
        `${summary} It is long enough that some chats will reject it — open it to trim it down first.`,
        'Open a copy'
      )
    : await vscode.window.showInformationMessage(summary, 'Open a copy');

  if (action === 'Open a copy') {
    // Untitled, so reviewing or trimming it never leaves a file behind.
    const doc = await vscode.workspace.openTextDocument({ content: text, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

/**
 * Writes the whole project's context as an `AGENTS.md` bundle other agents load
 * on their own. Writes files and nothing else — staging, committing, and ignoring
 * are the user's decisions.
 */
async function shareProject(store: DashboardStore, project: Project, homeDir: string): Promise<void> {
  // Hand-written AGENTS.md files are common; losing one would be destructive.
  // One generated here earlier carries the marker and is simply refreshed.
  const agentsPath = path.join(project.path, AGENTS_FILE);
  const existing = await readTextFile(agentsPath);
  if (existing !== null && !existing.includes(GENERATED_MARKER)) {
    const choice = await vscode.window.showWarningMessage(
      `${AGENTS_FILE} already exists in ${project.name}. Overwrite it?`,
      { modal: true, detail: `Files under ${CONTEXT_DIR}/ are regenerated either way.` },
      'Overwrite'
    );
    if (choice !== 'Overwrite') { return; }
  }

  const sessions = store.getSessions(project.id);
  const config = store.getProjectConfig(project.id);

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Generating agent context for ${project.name}…`,
    },
    async () => {
      const files = buildBundle(project, config, sessions)
        .map(file => ({ ...file, content: redactHome(file.content, homeDir) }));
      return writeBundle(files, project.path);
    }
  );

  if (result.failed.length > 0) {
    const names = result.failed.map(failure => path.basename(failure.path)).join(', ');
    vscode.window.showErrorMessage(
      `Agent context: ${result.failed.length} file(s) could not be written (${names}).`
    );
  }

  if (result.written.length === 0) { return; }

  const action = await vscode.window.showInformationMessage(
    `Shared ${sessions.length} session${sessions.length === 1 ? '' : 's'} as ${AGENTS_FILE} + ${CONTEXT_DIR}/ in ${project.name}.`,
    'Open AGENTS.md',
    'Reveal'
  );

  if (action === 'Open AGENTS.md') {
    await vscode.window.showTextDocument(vscode.Uri.file(agentsPath), { preview: true });
  } else if (action === 'Reveal') {
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(agentsPath));
  }
}

/**
 * Shares a project's context with other coding agents.
 *
 * The two scopes are deliberately different mechanisms, not one mechanism with a
 * filter: a project handoff is a standing file the agent picks up by itself, while
 * a session handoff is a one-off paste into a conversation already in progress.
 *
 * Either way the home directory is replaced with `~` as the last step, since
 * everything produced here is meant to leave the machine.
 */
export async function shareContext(
  store: DashboardStore,
  projectId: string,
  scope: ShareScope,
  sessionId?: string,
  homeDir: string = os.homedir()
): Promise<void> {
  const project = store.getProject(projectId);
  if (!project) { return; }

  if (scope === 'session') {
    await shareSession(store, project, sessionId, homeDir);
    return;
  }

  await shareProject(store, project, homeDir);
}
