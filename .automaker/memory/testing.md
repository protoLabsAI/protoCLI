---
tags: [testing]
summary: testing implementation decisions and patterns
relevantTo: [testing]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 0
  referenced: 0
  successfulFeatures: 0
---
# testing

#### [Gotcha] Playwright (browser test framework) cannot verify CLI application behavior (filesystem paths, terminal output, TUI startup), creating testing gap for terminal-based apps with acceptance criteria on filesystem and CLI output (2026-02-28)
- **Situation:** Feature acceptance criteria include: CLI help shows 'ava', config read from ~/.config/ava/, data stored in ~/.local/share/ava/ava.db. These are terminal/filesystem behaviors. Playwright is designed for browser-based testing
- **Root cause:** Playwright automates browser interactions. CLI applications have no browser UI - they interact with terminal and filesystem. The testing tool's abstraction layer doesn't match the application type
- **How to avoid:** Browser test tools provide excellent UI testing but are designed for web applications. Terminal apps need different test approaches (integration tests with shell/process spawning, filesystem assertions)

#### [Gotcha] Playwright/browser-based testing is incompatible with terminal UI applications; conventional web testing tools don't apply (2026-02-28)
- **Situation:** Feature is rendered in opentui (terminal rendering), not DOM; Playwright cannot interact with terminal
- **Root cause:** Playwright is designed for browser automation via CDP protocol; terminal UIs render to stdout, not web content
- **How to avoid:** Forced to use alternative verification: syntax checking (ts.transpileModule), manual curl testing, code review; no automated E2E for terminal UI