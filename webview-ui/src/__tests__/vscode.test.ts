import { describe, expect, it, vi } from 'vitest';

type VSCodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
type GlobalWithVsCode = typeof globalThis & {
  acquireVsCodeApi: () => VSCodeApi;
};

describe('vscode bridge', () => {
  it('posts through the VS Code API when available', async () => {
    const postMessage = vi.fn();
    (globalThis as GlobalWithVsCode).acquireVsCodeApi = () => ({ postMessage, getState: () => null, setState: () => undefined });
    vi.resetModules();
    const mod = await import('../vscode');
    mod.vscode.postMessage({ type: 'ping' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'ping' });
  });

  it('falls back safely when the VS Code API is unavailable', async () => {
    (globalThis as GlobalWithVsCode).acquireVsCodeApi = () => { throw new Error('no vscode'); };
    vi.resetModules();
    const mod = await import('../vscode');
    expect(() => mod.vscode.postMessage({ type: 'ping' })).not.toThrow();
  });
});
