# protoCli Brand Identity — Implementation Spec

This file is the authoritative source for protoCli visual identity and brand voice.
All TUI branding work MUST follow these specs exactly.

---

## Logo — `packages/opencode/src/cli/logo.ts`

The logo renderer uses a custom glyph system. Special characters in the string arrays:
- `_` → background-colored space (creates filled-block look in hollow letter interiors)
- `^` → `▀` rendered with fg AND bg colored (top-half highlight, creates ledge effect)
- `~` → `▀` in shadow color (drop-shadow at letter bottoms)
- All other chars → rendered in fg color

### Replacement logo arrays

```typescript
export const logo = {
  left: [
    "                   ",
    "▄▀▀▄ █  █ ▄▀▀▄    ",
    "█▀▀█  ^^  █▀▀█    ",
    "▀~~▀       ▀~~▀   ",
  ],
  right: [
    "              ▄    ",
    "▄▀▀  █  █▀█        ",
    "█___ █   █         ",
    "▀▀▀▀ █   ▀         ",
  ],
}

export const marks = "_^~"
```

**Left reads "ava":** two A's (dome top `▄▀▀▄`, crossbar `█▀▀█`, shadow `▀~~▀`) flanking a V
(uprights `█  █`, converging `^^` half-blocks, blank bottom row).

**Right reads "cli":** c = `▄▀▀ `/`█___`/`▀▀▀▀` (open right side),
l = `█`/`█`/`█` pillar, i = `█▀█`/`█`/`▀` (serif dot style).

**Row widths must match within each side.** If any row renders misaligned, pad with trailing
spaces to normalize. Run `bun run packages/opencode/src/index.ts` and visually verify the
logo renders as "ava | cli" before committing.

---

## Color Scheme — `packages/opencode/src/cli/ui.ts`

### Replace the logo() function color constants

Current (gray-based):
```typescript
const left = {
  fg: Bun.color("gray", "ansi") ?? "",
  shadow: "\x1b[38;5;235m",
  bg: "\x1b[48;5;235m",
}
const right = {
  fg: reset,
  shadow: "\x1b[38;5;238m",
  bg: "\x1b[48;5;238m",
}
```

Replace with (violet/protoLabs brand):
```typescript
const left = {
  fg: "\x1b[38;2;167;139;250m",    // violet-400 (#a78bfa) — protoLabs primary
  shadow: "\x1b[38;5;98m",          // ANSI-256 approx violet-700 for shadow
  bg: "\x1b[48;5;53m",              // ANSI-256 dark purple bg for fill chars
}
const right = {
  fg: reset,                         // right "cli" in default terminal color
  shadow: "\x1b[38;5;60m",          // muted purple-gray shadow
  bg: "\x1b[48;5;237m",             // near-black bg for right fill chars
}
```

### Replace the Style object

Current highlight color is cyan (`\x1b[96m`). Replace with violet:

```typescript
export const Style = {
  TEXT_HIGHLIGHT:      "\x1b[38;2;167;139;250m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[38;2;167;139;250m\x1b[1m",
  TEXT_DIM:            "\x1b[90m",
  TEXT_DIM_BOLD:       "\x1b[90m\x1b[1m",
  TEXT_NORMAL:         "\x1b[0m",
  TEXT_NORMAL_BOLD:    "\x1b[1m",
  TEXT_WARNING:        "\x1b[93m",
  TEXT_WARNING_BOLD:   "\x1b[93m\x1b[1m",
  TEXT_DANGER:         "\x1b[91m",
  TEXT_DANGER_BOLD:    "\x1b[91m\x1b[1m",
  TEXT_SUCCESS:        "\x1b[92m",
  TEXT_SUCCESS_BOLD:   "\x1b[92m\x1b[1m",
  TEXT_INFO:           "\x1b[38;2;96;165;250m",
  TEXT_INFO_BOLD:      "\x1b[38;2;96;165;250m\x1b[1m",
}
```

The only change from the original is:
- `TEXT_HIGHLIGHT`/`TEXT_HIGHLIGHT_BOLD`: cyan `\x1b[96m` → violet `\x1b[38;2;167;139;250m`
- `TEXT_INFO`/`TEXT_INFO_BOLD`: standard blue-94m → blue-400 true color

All other colors (warning yellow, danger red, success green, dim gray) remain unchanged —
semantic meaning must not change just for branding.

### Color reference table

| Role         | Hex       | True Color ANSI                    | ANSI-256 fallback   |
|--------------|-----------|-------------------------------------|---------------------|
| Primary      | `#a78bfa` | `\x1b[38;2;167;139;250m`           | `\x1b[38;5;141m`    |
| Primary dark | `#7c3aed` | `\x1b[38;2;124;58;237m`            | `\x1b[38;5;92m`     |
| BG fill      | `#2e1065` | `\x1b[48;2;46;16;101m`             | `\x1b[48;5;53m`     |
| Shadow       | `#4c1d95` | `\x1b[38;2;76;29;149m`             | `\x1b[38;5;98m`     |
| Info blue    | `#60a5fa` | `\x1b[38;2;96;165;250m`            | `\x1b[38;5;111m`    |

---

## Brand Voice — Welcome Message and First-Run Copy

### Tagline (shown in TUI header/session header)

```
ava  ·  protoLabs AI operator
```

No period. No em dash. The middle dot (`·`) is intentional — it reads as a soft separator,
not a bullet point.

### Welcome message (shown on home screen below the logo)

```
Your AI operator for protoLabs.
Ask about the board, open PRs, running agents, or what needs attention.
```

Two lines. Direct. No greeting opener ("Hi!", "Hello") — Ava is a system, not a chatbot.
First line states identity. Second line lists the operational domain.

### First-run dialog (shown only once, before Anthropic key setup)

```
Welcome to protoCli.

I'm Ava, the protoLabs AI operator. I manage your Automaker board, review PRs,
orchestrate agents, and help you ship.

Before we start, I need your Anthropic API key.
You can find it at console.anthropic.com.

API key:
```

No emoji. No exclamation points. Calm, professional, operational.

### Error messages — voice guidelines

- Auth failure: `"Anthropic key rejected. Check console.anthropic.com for key status."`
- MCP offline: `"Automaker is not running. Start it with: npm run dev"`
- Unknown error: `"Something went wrong. Check ~/.local/share/ava/ava.log for details."`

Pattern: state what happened, state what to do. No "Oops!" or "Uh oh!" openers.

### User-facing string replacements

Search the codebase for these strings and replace:

| Find                    | Replace with              |
|-------------------------|---------------------------|
| `opencode`              | `ava`                     |
| `OpenCode`              | `protoCli`                |
| `opencode-ai`           | `protocli`                |
| `~/.config/opencode`    | `~/.config/ava`           |
| `~/.local/share/opencode` | `~/.local/share/ava`    |
| `opencode.db`           | `ava.db`                  |
| `opencode.json`         | `ava.json`                |
| `OPENCODE_`             | `AVA_`                    |

**Exception:** Do NOT rename internal package names (`@opencode-ai/*`) — those are
upstream dependencies, not our branding surface. Only rename user-facing strings.

---

## Scope Discipline

This feature covers ONLY:
1. `packages/opencode/src/cli/logo.ts` — logo glyph arrays and marks export
2. `packages/opencode/src/cli/ui.ts` — color constants in logo() and Style object
3. User-facing string replacements (binary name, config paths, welcome copy)

Do NOT touch:
- Any files in `packages/opencode/src/session/` (system prompt is a separate feature)
- Any files in `packages/opencode/src/agent/` (agent config is a separate feature)
- Any files outside `packages/opencode/` (upstream packages, not our fork surface)
- Package.json name fields (handled in the distribution milestone)

---
