import { describe, expect, it, vi } from 'vitest';

describe('vscode bridge', () => {
  it('posts through the VS Code API when available', async () => {
    const postMessage = vi.fn();
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage, getState: () => null, setState: () => undefined });
    vi.resetModules();
    const mod = await import('../vscode');
    mod.vscode.postMessage({ type: 'ping' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'ping' });
  });

  it('falls back safely when the VS Code API is unavailable', async () => {
    (globalThis as any).acquireVsCodeApi = () => { throw new Error('no vscode'); };
    vi.resetModules();
    const mod = await import('../vscode');
    expect(() => mod.vscode.postMessage({ type: 'ping' })).not.toThrow();
  });
});
