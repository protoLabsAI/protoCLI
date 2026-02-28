---
tags: [ui]
summary: ui implementation decisions and patterns
relevantTo: [ui]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 0
  referenced: 0
  successfulFeatures: 0
---
# ui

### Brand color scheme implemented using ANSI codes (\x1b[95m magenta instead of \x1b[96m cyan) rather than specific hex colors (2026-02-28)
- **Context:** Need to implement protoLabs brand colors in CLI highlighting across all error/info prompts
- **Why:** ANSI codes provide maximum terminal portability (work everywhere) and are simpler to implement than hex-to-terminal-color conversion
- **Rejected:** Use brand-specified hex color with terminal color palette mapping for precision matching
- **Trade-offs:** Gained universal terminal compatibility, lost precise brand color fidelity - may not match brand guidelines requiring specific hex values
- **Breaking if changed:** If brand standards require exact hex color matching, all TEXT_HIGHLIGHT usage globally will appear wrong in terminal output

#### [Pattern] Logo component interprets shadow marker characters (~~ for trailing shadow, ^^^ for top shadows) to add visual styling within text-only ASCII art constraints (2026-02-28)
- **Problem solved:** Updating ASCII logo art for new branding while working within terminal's text-only rendering model
- **Why this works:** Provides visual depth and styling effects to purely text-based ASCII art without requiring color or special terminal features, creating visual hierarchy
- **Trade-offs:** Gained visual styling and branding polish within text constraints, limited to only shadow effects as styling options

### MCP tool output summarization reduces structured output to compact single-line format: arrays show 'N items', objects show 'N fields', strings truncated to 60 chars. (2026-02-28)
- **Context:** MCP tools (e.g., list_features, get_context) return structured JSON that exceeds TUI terminal width if displayed fully.
- **Why:** Terminal space is constrained. Simple summary preserves essential info (command executed, result count) without overwhelming display. Pending state shows 'Calling [tool]...' for user feedback.
- **Rejected:** Could show full JSON output (loses context at a glance), or show nothing (user has no feedback). Selected middle ground.
- **Trade-offs:** Gains readability and UX responsiveness at cost of detail. User cannot see field names in object summaries. Intentionally simple so tool-specific schemas can extend it later.
- **Breaking if changed:** Removing summarization would require either scrolling JSON output or finding another display strategy.

#### [Pattern] Custom brand colors defined via RGBA.fromHex() is the canonical TUI pattern. Already used in theme.tsx for 5+ color definitions. (2026-02-28)
- **Problem solved:** Adding Ava violet (#a78bfa) branding requires choosing how to define custom colors in TUI components.
- **Why this works:** RGBA.fromHex is established in codebase. Consistent with existing theming approach. Provides type safety and avoids magic hex strings.
- **Trade-offs:** Slightly more verbose (`RGBA.fromHex()` vs inline hex) but gains consistency and allows centralized color management.