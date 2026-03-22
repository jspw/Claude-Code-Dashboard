import { vi } from 'vitest';

const _state: Record<string, unknown> = {};

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
  })),
  fs: {
    writeFile: vi.fn(),
  },
};

export const window = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showSaveDialog: vi.fn(),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    backgroundColor: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  createWebviewPanel: vi.fn(() => ({
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: vi.fn(),
      postMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: unknown) => uri),
      cspSource: 'test-csp',
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn(),
    dispose: vi.fn(),
  })),
  registerWebviewViewProvider: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

export const Uri = {
  file: vi.fn((p: string) => ({ fsPath: p, scheme: 'file', path: p })),
  joinPath: vi.fn((_base: unknown, ...segments: string[]) => ({
    fsPath: segments.join('/'),
    scheme: 'file',
    path: segments.join('/'),
  })),
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export const ExtensionContext = {};

export function createMockExtensionContext(): {
  subscriptions: { dispose(): void }[];
  extensionUri: ReturnType<typeof Uri.file>;
  globalStorageUri: ReturnType<typeof Uri.file>;
  globalState: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
} {
  return {
    subscriptions: [],
    extensionUri: Uri.file('/test/extension'),
    globalStorageUri: Uri.file('/test/storage'),
    globalState: {
      get: vi.fn((key: string, defaultValue?: unknown) => _state[key] ?? defaultValue),
      update: vi.fn((key: string, value: unknown) => {
        _state[key] = value;
        return Promise.resolve();
      }),
    },
  };
}
