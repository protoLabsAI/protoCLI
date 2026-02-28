---
tags: [gotchas]
summary: gotchas implementation decisions and patterns
relevantTo: [gotchas]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 1
  referenced: 1
  successfulFeatures: 1
---
# gotchas

#### [Gotcha] import.meta.dirname points to different locations depending on execution context: source directory when running source, executable directory when running compiled binary (2026-02-28)
- **Situation:** Path to ava.jsonc uses import.meta.dirname; works in development but fails in production binary without graceful fallback
- **Root cause:** Bun (and similar compilers) resolve import.meta.dirname at compile time to the binary output location, not the source location
- **How to avoid:** import.meta.dirname is portable but context-dependent; requires understanding of how bundlers work