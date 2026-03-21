# Security Policy

## Supported versions

Only the latest published version of Claude Code Dashboard receives security fixes.

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | No        |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing the maintainer directly (see the [repository profile](https://github.com/jspw)) or by using GitHub's private vulnerability reporting feature:

1. Go to the **Security** tab of this repository
2. Click **Report a vulnerability**
3. Fill in the details

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested fix if you have one

You can expect an acknowledgement within 72 hours and a resolution or status update within 14 days.

## Scope

This extension runs entirely locally — it reads files from `~/.claude/` and your project directories, makes no network requests, and stores no credentials. The attack surface is limited to:

- Malicious content in `~/.claude/projects/` JSONL files being rendered in the webview
- The hook injection into `~/.claude/settings.json`

Out of scope: vulnerabilities in VS Code itself, the Claude Code CLI, or the user's own project files.
