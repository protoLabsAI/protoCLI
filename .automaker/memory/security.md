---
tags: [security]
summary: security implementation decisions and patterns
relevantTo: [security]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 0
  referenced: 0
  successfulFeatures: 0
---
# security

### User-agent header identifies by tool name (ava) not package name (protocli) or workspace name (opencode) (2026-02-28)
- **Context:** Changed user-agent from 'opencode/version' to 'ava/version' in build.ts execArgv
- **Why:** HTTP user-agent should reflect what users actually run (the 'ava' command). Servers classify clients by tool identity for analytics, rate limiting, compatibility checks. Tool name is what's user-visible and debuggable
- **Rejected:** Package name in user-agent (servers don't know what 'protocli' package is). Version-only (uninformative for identification)
- **Trade-offs:** Makes server-side logging clearer vs breaks any existing user-agent parsing expecting 'opencode'. Analytics data keyed by 'ava' makes it harder to trace back to old 'opencode' deployments
- **Breaking if changed:** Server-side rate limiting, filtering, or analytics rules keyed to 'opencode' user-agent stop working. Requires server updates to recognize 'ava'