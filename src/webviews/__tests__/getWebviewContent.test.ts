import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { getWebviewContent } from '../getWebviewContent';

describe('getWebviewContent', () => {
  it('embeds initial state, view, resource uris, and escaped closing tags', () => {
    const webview = {
      cspSource: 'vscode-resource:',
      asWebviewUri: vi.fn((uri) => `webview:${(uri as any).path}`),
    } as any;

    const html = getWebviewContent(webview, vscode.Uri.file('/ext'), 'dashboard', { value: '</script>' });

    expect(html).toContain('__INITIAL_VIEW__ = "dashboard"');
    expect(html).toContain('webview:webview-ui/dist/assets/index.js');
    expect(html).toContain('webview:webview-ui/dist/assets/index.css');
    expect(html).toContain('<\\/script>');
    expect(html).toContain("script-src 'nonce-");
  });
});
