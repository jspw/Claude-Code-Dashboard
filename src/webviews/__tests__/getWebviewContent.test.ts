import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { getWebviewContent } from '../getWebviewContent';

type WebviewLike = {
  cspSource: string;
  asWebviewUri: (localResource: vscode.Uri) => vscode.Uri;
};

describe('getWebviewContent', () => {
  it('embeds initial state, view, resource uris, and escaped closing tags', () => {
    const webview: WebviewLike = {
      cspSource: 'vscode-resource:',
      asWebviewUri: vi.fn((uri: vscode.Uri) => ({
        path: `webview:${uri.path}`,
        toString: () => `webview:${uri.path}`,
      } as unknown as vscode.Uri)),
    };

    const html = getWebviewContent(webview as vscode.Webview, vscode.Uri.file('/ext'), 'dashboard', { value: '</script>' });

    expect(html).toContain('__INITIAL_VIEW__ = "dashboard"');
    expect(html).toContain('webview:webview-ui/dist/assets/index.js');
    expect(html).toContain('webview:webview-ui/dist/assets/index.css');
    expect(html).toContain('<\\/script>');
    expect(html).toContain("script-src 'nonce-");
  });
});
