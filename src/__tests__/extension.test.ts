import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockExtensionContext } from './__mocks__/vscode';

type ExportSession = {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  totalTokens: number;
  costUsd: number;
  promptCount: number;
  toolCallCount: number;
};

type InfoMessageResult = Awaited<ReturnType<typeof vscode.window.showInformationMessage>>;

vi.mock('os', () => ({ homedir: vi.fn(() => '/mock/home') }));

const mockStore = {
  initialize: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn(),
  getProjects: vi.fn(() => [{ id: 'p1', name: 'Alpha' }]),
  getProject: vi.fn(() => ({ id: 'p1', name: 'Alpha' })),
  getSessions: vi.fn<() => ExportSession[]>(() => []),
  on: vi.fn(),
};

const mockFileWatcher = { start: vi.fn() };
const mockEventWatcher = { start: vi.fn() };
const mockHookManager = { injectHooks: vi.fn(() => Promise.resolve()), needsReinjection: vi.fn(() => false) };
const mockAlertManager = { checkWeeklyDigest: vi.fn() };

vi.mock('../store/DashboardStore', () => ({ DashboardStore: vi.fn(() => mockStore) }));
vi.mock('../watchers/FileWatcher', () => ({ FileWatcher: vi.fn(() => mockFileWatcher) }));
vi.mock('../watchers/EventWatcher', () => ({ EventWatcher: vi.fn(() => mockEventWatcher) }));
vi.mock('../hooks/HookManager', () => ({ HookManager: vi.fn(() => mockHookManager) }));
vi.mock('../providers/SidebarProvider', () => ({ SidebarProvider: vi.fn(() => ({})) }));
vi.mock('../providers/StatusBarProvider', () => ({ StatusBarProvider: vi.fn(() => ({ dispose: vi.fn() })) }));
vi.mock('../webviews/DashboardPanel', () => ({ DashboardPanel: { createOrShow: vi.fn() } }));
vi.mock('../webviews/ProjectPanel', () => ({ ProjectPanel: { createOrShow: vi.fn() } }));
vi.mock('../alerts/AlertManager', () => ({ AlertManager: vi.fn(() => mockAlertManager) }));

import { activate, deactivate } from '../extension';
import { DashboardStore } from '../store/DashboardStore';
import { HookManager } from '../hooks/HookManager';
import { DashboardPanel } from '../webviews/DashboardPanel';
import { ProjectPanel } from '../webviews/ProjectPanel';

function getRegisteredCommand(name: string): (...args: unknown[]) => unknown {
  const command = vi.mocked(vscode.commands.registerCommand).mock.calls.find((call) => call[0] === name)?.[1];
  expect(command).toBeDefined();
  return command as (...args: unknown[]) => unknown;
}

describe('extension activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates services, registers commands, starts watchers, initializes, and opens the dashboard', async () => {
    const context = createMockExtensionContext();
    context.globalState.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'hooksConfigured') return false;
      return defaultValue;
    });
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);

    await activate(context as unknown as vscode.ExtensionContext);

    expect(DashboardStore).toHaveBeenCalledOnce();
    expect(HookManager).toHaveBeenCalledOnce();
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('claudeDashboard.sidebar', expect.anything(), expect.anything());
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(4);
    expect(mockFileWatcher.start).toHaveBeenCalledWith(context);
    expect(mockEventWatcher.start).toHaveBeenCalledWith(context);
    expect(mockStore.initialize).toHaveBeenCalledOnce();
    expect(DashboardPanel.createOrShow).toHaveBeenCalledWith(context, mockStore);
    expect(mockAlertManager.checkWeeklyDigest).toHaveBeenCalledOnce();
    expect(typeof deactivate).toBe('function');
  });

  it('configures hooks on first run and reuses project-open command', async () => {
    const context = createMockExtensionContext();
    context.globalState.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'hooksConfigured') return false;
      return defaultValue;
    });
    vi.mocked(vscode.window.showInformationMessage)
      .mockResolvedValueOnce('Yes, configure hooks' as unknown as InfoMessageResult)
      .mockResolvedValueOnce(undefined);

    await activate(context as unknown as vscode.ExtensionContext);

    expect(mockHookManager.injectHooks).toHaveBeenCalledWith(context.globalState);
    expect(context.globalState.update).toHaveBeenCalledWith('hooksConfigured', true);

    const openProjectHandler = getRegisteredCommand('claudeDashboard.openProject');
    openProjectHandler('p1');
    expect(ProjectPanel.createOrShow).toHaveBeenCalledWith(context, mockStore, 'p1');
  });

  it('wires refresh and exportSessions command flows end-to-end', async () => {
    const context = createMockExtensionContext();
    context.globalState.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'hooksConfigured') return true;
      return defaultValue;
    });
    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(vscode.Uri.file('/tmp/sessions.json'));

    mockStore.getProject.mockReturnValue({ id: 'p1', name: 'Alpha' });
    mockStore.getSessions.mockReturnValue([
      {
        id: 's1',
        startTime: 1,
        endTime: 2,
        durationMs: 1,
        totalTokens: 10,
        costUsd: 0.123456,
        promptCount: 2,
        toolCallCount: 3,
      },
    ]);

    await activate(context as unknown as vscode.ExtensionContext);

    const refreshHandler = getRegisteredCommand('claudeDashboard.refresh');
    const exportHandler = getRegisteredCommand('claudeDashboard.exportSessions');

    refreshHandler();
    await exportHandler('p1', 'json');
    await exportHandler('p1', 'csv');

    expect(mockStore.refresh).toHaveBeenCalledOnce();
    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(2);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Sessions exported to /tmp/sessions.json');
  });

  it('covers openDashboard, skipped exports, and hook reinjection', async () => {
    const context = createMockExtensionContext();
    context.globalState.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'hooksConfigured') return true;
      return defaultValue;
    });
    mockHookManager.needsReinjection.mockReturnValue(true);
    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(undefined);
    mockStore.getProject.mockImplementationOnce(() => undefined as never);

    await activate(context as unknown as vscode.ExtensionContext);

    const openDashboardHandler = getRegisteredCommand('claudeDashboard.openDashboard');
    const exportHandler = getRegisteredCommand('claudeDashboard.exportSessions');

    openDashboardHandler();
    await exportHandler('missing-project', 'json');
    await exportHandler('p1', 'json');

    expect(DashboardPanel.createOrShow).toHaveBeenCalledTimes(2);
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(mockHookManager.injectHooks).toHaveBeenCalledWith(context.globalState);
    expect(deactivate()).toBeUndefined();
  });
});
