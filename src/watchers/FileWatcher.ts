import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DashboardStore } from '../store/DashboardStore';

export class FileWatcher {
  private claudeDir: string;
  private store: DashboardStore;
  private watcher?: fs.FSWatcher;
  private sessionsWatcher?: fs.FSWatcher;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionsTimer?: NodeJS.Timeout;
  // Changes seen while this window is unfocused, applied once it regains focus.
  private pending: Set<string> = new Set();
  private liveSessionsPending = false;

  constructor(claudeDir: string, store: DashboardStore) {
    this.claudeDir = claudeDir;
    this.store = store;
  }

  start(context: vscode.ExtensionContext) {
    const projectsDir = path.join(this.claudeDir, 'projects');
    if (!fs.existsSync(projectsDir)) { return; }

    try {
      // Use Node's native fs.watch with recursive=true (macOS uses FSEvents, fast & reliable)
      // vscode.workspace.createFileSystemWatcher only works inside the workspace folder
      this.watcher = fs.watch(projectsDir, { recursive: true }, (_event, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) { return; }

        const filePath = path.join(projectsDir, filename);

        // Debounce per file — a session JSONL gets many rapid writes during a turn
        const existing = this.debounceTimers.get(filePath);
        if (existing) { clearTimeout(existing); }

        this.debounceTimers.set(filePath, setTimeout(() => {
          this.debounceTimers.delete(filePath);
          this.dispatch(filePath);
        }, 300));
      });

      this.watcher.on('error', (err) => {
        console.error('Claude Code Dashboard FileWatcher error:', err);
      });
    } catch (e) {
      console.error('Claude Code Dashboard: failed to start file watcher on', projectsDir, e);
    }

    this.watchLiveSessions();

    const focusListener = vscode.window.onDidChangeWindowState(state => {
      if (state.focused) { this.flushPending(); }
    });

    context.subscriptions.push({
      dispose: () => {
        this.watcher?.close();
        this.sessionsWatcher?.close();
        focusListener.dispose();
        this.debounceTimers.forEach(t => clearTimeout(t));
        clearTimeout(this.sessionsTimer);
      }
    });
  }

  /**
   * Each running Claude Code session rewrites ~/.claude/sessions/<pid>.json when
   * it turns busy, waits on you, or goes idle, often without touching its transcript.
   */
  private watchLiveSessions() {
    const sessionsDir = path.join(this.claudeDir, 'sessions');
    try {
      this.sessionsWatcher = fs.watch(sessionsDir, (_event, filename) => {
        if (!filename || !filename.endsWith('.json')) { return; }
        clearTimeout(this.sessionsTimer);
        this.sessionsTimer = setTimeout(() => this.dispatchLiveSessions(), 300);
      });
      this.sessionsWatcher.on('error', (err) => {
        console.error('Claude Code Dashboard sessions watcher error:', err);
      });
    } catch {
      // No sessions/ directory: an older Claude Code, so liveness comes from transcripts and hooks.
    }
  }

  private dispatchLiveSessions() {
    if (vscode.window.state.focused) {
      this.store.refreshLiveSessions();
    } else {
      this.liveSessionsPending = true;
    }
  }

  /**
   * Every open window runs its own watcher, so with several windows each change
   * was parsed once per window (#34). Only the focused window parses right away;
   * the others catch up when focused.
   */
  private dispatch(filePath: string) {
    if (vscode.window.state.focused) {
      this.store.onFileChanged(filePath);
    } else {
      this.pending.add(filePath);
    }
  }

  private flushPending() {
    const files = [...this.pending];
    this.pending.clear();
    for (const filePath of files) { this.store.onFileChanged(filePath); }
    if (this.liveSessionsPending) {
      this.liveSessionsPending = false;
      this.store.refreshLiveSessions();
    }
  }
}
