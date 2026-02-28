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

#### [Pattern] Code validated via pattern matching against existing working code (web.ts as reference) and Node.js file checks when primary build tool unavailable (2026-02-28)
- **Problem solved:** Bun provided via Nix flake dev shell, not in PATH; full typecheck impossible but changes needed validation
- **Why this works:** Pragmatic validation when build tool temporarily unavailable; existing patterns in codebase are reliable reference; Node.js can verify syntax and imports
- **Trade-offs:** Less comprehensive than full typecheck but practical; assumes pattern reuse is correct (verified by comparison)

#### [Gotcha] TypeScript type checking tools (bun, tsgo) may not be available in CI/deployment environments. Verification must fall back to pattern-matching against existing codebase. (2026-02-28)
- **Situation:** Changes implement new components (McpTool) and modify existing logic without ability to run tsc.
- **Root cause:** Environment constraints (no bun runtime). Pragmatic workaround: verify against established patterns (same imports, similar component structure).
- **How to avoid:** Gains confidence through pattern verification vs certainty of compiler check. Works for straightforward logic but misses subtle type errors.

#### [Gotcha] Partial verification (bash syntax + JSON validation) misses runtime issues when full build tool unavailable (2026-02-28)
- **Situation:** bun not available in environment, so full build couldn't run. Verified with bash -n and node JSON.parse instead
- **Root cause:** Practical fallback when build tool missing - something is better than nothing. Catches syntax errors and malformed config
- **How to avoid:** Catches basic errors vs misses path resolution errors, missing required files, archive creation issues. Safe for syntax confidence but not runtime confidence