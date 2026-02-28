---
tags: [api]
summary: api implementation decisions and patterns
relevantTo: [api]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 1
  referenced: 0
  successfulFeatures: 0
---
# api

#### [Gotcha] Treating all non-200 responses (including 401 auth) as 'offline' state masks authentication failures as connectivity issues (2026-02-28)
- **Situation:** API returns 401, implementation catches with !res.ok, shows 'Automaker offline' instead of 'auth required'
- **Root cause:** Graceful degradation - any failure mode results in same fallback UI, which is simpler than branching on error types
- **How to avoid:** User-friendly fallback UI but hides auth problems; developers may struggle to diagnose 401 in production if they expect auth errors to appear different

#### [Gotcha] API response field names (inProgress vs in_progress, recentFeatures schema) are assumed without validation or type guards (2026-02-28)
- **Situation:** Type definitions expect camelCase fields; if Automaker API uses snake_case, properties silently become undefined
- **Root cause:** Rapid prototyping assumed field names match TypeScript types; no schema validation or parsing
- **How to avoid:** Fewer lines of code initially but fragile to API changes; type safety is false (TS types don't validate runtime shape)