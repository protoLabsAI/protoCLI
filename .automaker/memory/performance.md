---
tags: [performance]
summary: performance implementation decisions and patterns
relevantTo: [performance]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 0
  referenced: 0
  successfulFeatures: 0
---
# performance

#### [Pattern] AbortSignal.timeout(3000) provides clean request timeout without Promise.race or setTimeout cleanup complexity (2026-02-28)
- **Problem solved:** Network request to Automaker API needs timeout to avoid hanging if service is slow
- **Why this works:** Bun/modern fetch API supports AbortSignal.timeout natively; cleaner than Promise.race(fetch, timeout()) with manual cleanup
- **Trade-offs:** Simpler code (one line) vs older patterns (more boilerplate); but requires runtime support and doesn't allow timeout + retry