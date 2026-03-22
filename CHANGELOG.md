# Changelog

All notable changes to Claude Code Dashboard will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

> **Note:** From v1.4.0 onwards this file is maintained automatically by
> [release-please](https://github.com/googleapis/release-please) based on
> conventional commit messages. Do not edit it manually.

---

## [1.4.0](https://github.com/jspw/Claude-Code-Dashboard/compare/claude-code-dashboard-v1.3.0...claude-code-dashboard-v1.4.0) (2026-03-22)


### Features

* markdown show preview for session's prompts ([2d7878a](https://github.com/jspw/Claude-Code-Dashboard/commit/2d7878a2148228f5c4a8a414a1cb24be7eb7a015))


### Bug Fixes

* **release:** resolve release version issue ([f6d21a2](https://github.com/jspw/Claude-Code-Dashboard/commit/f6d21a25139bd87e0ef5c795b962298e1d90bb8b))
* **release:** resolve release version issue ([f6d21a2](https://github.com/jspw/Claude-Code-Dashboard/commit/f6d21a25139bd87e0ef5c795b962298e1d90bb8b))
* **release:** resolve release version issue ([afb43e4](https://github.com/jspw/Claude-Code-Dashboard/commit/afb43e4ae03ca1e2d7f63fa70439426e7499c60f))
* **release:** resolve release version issue ([ced3e89](https://github.com/jspw/Claude-Code-Dashboard/commit/ced3e8987459882c2ca1ba4354486bcb8b09d86c))

## [Unreleased]

---

## [1.3.0] — 2025

### Added
- CLAUDE.md tab in project detail view — shows project instructions file when present
- Skills and commands panel in project detail view
- Weekly stats tab in project detail view
- AM/PM time format throughout the UI

### Fixed
- Build pipeline errors
- All-projects view showing incorrect sidebar selection state

---

## [1.2.0]

### Added
- Idle stats tracking
- Real-time active session indicator in sidebar
- Improved sidebar projects section with better layout and stats

### Fixed
- Active session and project count mismatch
- MCP servers read errors
- Bottom status bar color
- Active and recent project tracking made more robust

---

## [1.1.0]

### Added
- CI/CD pipeline for automated publishing to VS Code Marketplace and Open VSX
- Default dashboard auto-open on sidebar activation
- Webview-based panel view

---

## [1.0.0] — Initial release

### Added
- Overview tab — weekly recap, token and cost stats, project list with filtering and sorting
- Charts tab — 30-day token trend, usage by project, projected monthly cost
- Search tab — full-text search across all historical prompts
- Insights tab — usage heatmap, tool breakdown, productivity by hour, hot files
- Project detail view — session history, turn-by-turn conversation, token breakdown, files touched
- MCP Servers tab per project
- Export to JSON and CSV
- Real-time tracking via PostToolUse and Stop hooks in `~/.claude/settings.json`
- Monthly token and cost budget alerts
- No telemetry, no network requests, fully local
