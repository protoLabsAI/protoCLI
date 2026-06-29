# Spec: Aggressive TUI Overhaul — Calm, Reversible, Steerable, Discoverable

> Status: **Proposed** · No backwards-compat constraint · Ink 6 + React 19, `packages/cli/src/ui`
> Source of truth for the TUI redesign. Derived from a 17-agent due-diligence recon (10 competitor/craft research lenses + codebase analysis + adversarial Ink-feasibility critique, 2026-06-28).

## Situation

proto's TUI is a mature Qwen-Code / Gemini-CLI lineage fork built on **Ink 6.2.3 + React 19** (~66k LOC under `packages/cli/src/ui`). It already has a deep feature bench — vim mode, voice, kitty keyboard protocol, 25 themes, MCP/hooks/subagent dialogs, transcript overlay, rewind. But it carries the structural debt of its lineage and has drifted behind the 2026 bar set by Claude Code, Codex CLI, Charm/Crush, and opencode.

This is an **aggressive, no-legacy redesign** — not a polish pass. The goal: the tightest TUI in its lineage. Calm on the happy path, reversible at every step, steerable mid-turn, discoverable without memorization — and it earns all of that _inside real scrollback_, never by seizing the alternate screen.

The architecture centers on a few giants we will be reshaping:

| File                                   | LOC  | Role                                                                                                                                                            |
| -------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppContainer.tsx`                     | 1833 | God-component / orchestrator; builds a ~120-field `uiState` memo (`:1433`) with a ~115-entry dep array; whole-tree re-render on any field change                |
| `hooks/useGeminiStream.ts`             | 2230 | Streaming engine; `Esc`=cancel discards in-flight work; partial-flush-to-history exists at `:584-589`                                                           |
| `components/shared/text-buffer.ts`     | 2368 | Editor buffer; `calculateLayout` (`:644`) re-wraps whole buffer per edit with per-code-point width; `pushUndo` (`:866`) snapshots whole `lines[]` per keystroke |
| `components/InputPrompt.tsx`           | 1372 | Composer; one 625-line `handleInput` (47-dep); dead `selectionAnchor`; two 500ms ESC windows (`:559`, `:701`)                                                   |
| `components/messages/DiffRenderer.tsx` | 380  | Unified-only; filters out `hunk` rows (`:195-197`) so function scope is lost; re-colorizes every render (no memo)                                               |

---

> **Update (2026-06-28): the full-screen reversal.** This spec originally treated alt-screen as rejected, on the belief that Claude Code deliberately keeps inline scrollback. That belief is now **stale**: Claude Code shipped alt-screen opt-in (`CLAUDE_CODE_NO_FLICKER`, v2.1.88, Mar 30 2026) and defaulted it on via server-side flag ~v2.1.150 (late May 2026). The full-screen _look_ (pinned composer, dedicated stream region, no flicker, "room to breathe") is genuinely loved. But default-fullscreen remains the most-reverted call in the space — **Gemini CLI shipped it as default (~v0.16) and reverted within ~2 weeks** (PR #13623), opencode/Crush still carry unsolved copy/scroll complaints, and CC's flip broke native scrollback, `Cmd+F`, and macOS VoiceOver. Verdict adopted here: **full-screen done right, opt-in→default, inline always a fallback** (see S0 and the revised Ceiling section).

## The bar — due diligence summary

What the best-in-class terminal coding agents do that proto should adopt:

| Source                              | Patterns worth stealing                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code** (the bar)           | `Shift+Tab` **autonomy dial** + persistent footer chip (the #1 muscle-memory gesture) · **`Esc`=interrupt-but-keep-work, `Esc Esc`=rewind** · collapse-by-default tool calls + `Ctrl+O` transcript · flicker-free differential renderer + synchronized output (DEC mode 2026), **scrollback kept on purpose** · spinner verbs + live "Thinking for Ns" counter · git-seeded ghost-text prompts |
| **Codex CLI** (Rust/ratatui)        | **Steer/Queue** mid-turn (Enter steers, Tab queues) · **numbered single-key approval modal** · dim-bulleted tool cells + "Explored" collapse. _Caveat:_ alt-screen takeover broke native selection — their #1 complaint                                                                                                                                                                        |
| **Charm / Crush**                   | Gradient "Thinking" spinner · **diff rendered inside the permission dialog + 350ms keypress debounce** · semantic palette + gradient brand ("designed, not assembled")                                                                                                                                                                                                                         |
| **sst/opencode**                    | **Adaptive "system" theme** (inherits terminal bg/ANSI/transparency) · **inline LSP diagnostics fed back to the model to self-correct** · "Allow for session" · pause-on-scroll. _Caveat:_ git-history-driven undo corrupted repos — a lesson, not a feature                                                                                                                                   |
| **aider / delta / lazygit / helix** | **Word-level diffs + function-scope hunk headers** (delta's most-loved feature) · which-key popup + command palette + generated cheat-sheet · honest edit-failure UX (show the near-miss anchor)                                                                                                                                                                                               |
| **Sentiment meta**                  | Flicker was the #1 historical complaint. Native scrollback / selection / search are **sacred**. Table stakes: calm output, one-key interrupt, discoverable keys.                                                                                                                                                                                                                               |

---

## Design principles

1. **Two modes, one with an escape hatch always.** proto ships both an **inline** renderer (committed to native scrollback — the safe fallback, keeps native copy/scroll/search/VoiceOver) and a **full-screen** mode (alternate screen, pinned composer, dedicated streaming region — the premium "room to breathe" look). Full-screen is opt-in now and auto-enables on capable terminals; inline is always reachable via `/tui default`. The non-negotiable: whenever full-screen captures the screen/mouse, a _discoverable_ copy path (OSC-52 yank) and a one-key **drop-to-inline** escape hatch ship with it. The decision that burned Gemini (reverted in ~2 weeks), opencode, and Crush was forcing full-screen with **no** escape — not full-screen itself. (See S0.)
2. **Calm by default, detail on demand.** The happy path is a clean conversation. Tool calls collapse to one dim line; the firehose is one keystroke away. Noise is opt-in.
3. **Reversible and steerable.** Nothing the agent does is a point of no return. `Esc` interrupts and **keeps** completed work; `Esc Esc` rewinds. You steer or queue mid-turn without cancel/restart.
4. **One source of truth per concern.** One keymap generates help + which-key + the `?` strip; one status-line config; one state store. Delete every place where two hand-maintained lists can drift.
5. **The edit IS the UI.** Diffs are a review surface (word-level emphasis, function-scope headers); approvals co-locate the decision with the evidence.
6. **Premium equals fast.** Coalesce streaming to a frame budget, subscribe to state slices not the whole tree. Performance is a visible feature.
7. **Whimsy is opt-out, never mandatory.** Gradient spinners and verb packs ship on, are trivially disabled, and every motion honors reduce-motion and the screen-reader path.

---

## Ink-6 ceiling — hard constraints (verified)

These were verified against `node_modules/ink/build/render.d.ts` and proto source. **Do not design around physics.** No-legacy does not change what Ink can do.

- **`incrementalRendering` is not a real Ink 6.2.3 option.** `RenderOptions` is exactly `{stdout, stdin, stderr, debug, exitOnCtrlC, patchConsole, isScreenReaderEnabled}`. Any plan that budgets flicker reduction to this flag is dead on arrival. Real in-framework wins come only from (a) a selector store cutting dynamic-region JS and (b) throttling streaming `setState`.
- **Ink repaints the whole frame every commit** (full Yoga layout → frame string → `log-update` diff), regardless of which React leaf changed. `<Static>` _already_ isolates committed history from repaint. A selector store cuts **JS churn**, not terminal paint. Only a custom reconciler changes the paint model — that is a deferred, separately-funded spike, **not** part of this work.
- **`<Static>` history is append-only and frozen — in INLINE mode.** `MainContent.tsx:36-40` documents it: the items array "must only ever grow." In inline mode you cannot expand/collapse, re-wrap, or word-diff a tool cell once it has scrolled into committed history without remounting `<Static>` (= `clearTerminal` + full reprint = max flicker), so those work only in the live/pending region. **Full-screen mode abandons `<Static>` for a hand-built virtualized viewport, where expand/collapse, re-wrap, word-diff, and pause-on-scroll all become possible** (that's a chief reason to build it).
- **There is no "reprint header only" fast path in inline mode.** The header is `<Static>` item[0]; repainting it alone is impossible. Move the model/theme badge into the dynamic footer/StatusBar instead. (In full-screen mode the whole frame is hand-drawn, so this is moot.)
- **Pause-on-scroll-up + "N new" pill is a FULL-SCREEN feature, not inline.** In inline mode the terminal owns scrollback and proto receives zero scroll events; the honest inline equivalent is the `Ctrl+O` transcript pager. In full-screen mode proto owns the viewport and the scroll state, so pause-on-scroll, auto-follow tail, and the "jump to latest ↓ (N new)" pill are all natural — gated to that mode.
- **Full-screen / `alternateScreen` is an Ink 7 feature; proto is on Ink 6.2.3.** Two doors: (a) **upgrade to Ink 7** — one-line `alternateScreen: true` at the `render()` site (`gemini.tsx:202`) but costs Node 22 + React 19.2 and breaking keyboard-input changes (`key.backspace` vs `key.delete`, plain Escape no longer sets `key.meta`) that hit `KeypressContext`/`useKeyboardHandling`; or (b) **hand-roll DEC 1049** (`\x1b[?1049h`/`l`, ~30 lines à la `fullscreen-ink`) and own teardown across `process.exit`/SIGINT/SIGTERM/`uncaughtException`/resize. Default recommendation: **hand-roll (Path B)** to decouple full-screen from a risky Ink-7/Node-22 bump. **The seed already exists: `TranscriptOverlay.tsx` is a working hand-rolled full-screen scroll viewport** — generalize it rather than start from scratch.
- **Naïve full-screen is SLOWER than today's inline `<Static>`.** `<Static>` renders each history item exactly once; full-screen "render-everything-and-clip" (what `TranscriptOverlay` does today) reconciles + re-measures all N items every scroll tick and stream frame — fine for an occasional overlay, a cliff as the default view. Full-screen-by-default **requires true height-aware virtualization** (measure-then-slice the visible window), which is the single biggest piece of net-new engineering and the highest risk in S0.
- **Ink has zero mouse support.** Wheel-scroll in full-screen requires emitting SGR mouse modes (`?1000h`+`?1006h`) and hand-parsing the `\x1b[<b;x;yM` reports in `KeypressContext` (insertion point: the existing `TERMINAL_RESPONSE_RE` filter), and enabling capture costs native selection — hence the mandatory OSC-52 + drop-to-inline escape hatch.
- **"Steer" cannot inject tokens mid-generation.** No streaming API (Gemini/Qwen/ACP) supports it. Real "steer" = interrupt → preserve partial (half-built at `useGeminiStream.ts:584-589`) → resubmit merged. Validate the merge against the **ACP / acp-cron delegate path** before committing it.
- **Synchronized output (DEC `?2026`) is hard-disabled on TMUX/SSH for a reason** (`synchronizedOutput.ts:51-53`). Probing via `CSI ?2026$p` requires reading the reply off stdin, which races Ink's raw-mode readline + the kitty probe; an unconsumed reply leaks as stray keystrokes. Keep env allow-list + always-emit no-op fallback; if probing, do it once at startup _before_ Ink takes raw-mode stdin, with a strict timeout, and swallow the reply.
- **Side-by-side diff is a Yoga column-alignment trap.** Flex rows don't pad the shorter wrapped column, so gutters/line-numbers desync. Inline word-level emphasis delivers ~90% of the value at a fraction of the risk. Cut side-by-side.
- **OSC-8 links hand a URI to the emulator; they cannot invoke `$EDITOR`.** Use the existing launch-editor path for "open in editor," OSC-8 only for real URLs.

---

## Signature moves (Ink-honest)

Ranked sharpest-first. Impact/effort and target files included. **S0 is the architecture-defining pillar; S1–S9 are renderer-agnostic and land inside whichever mode is active.**

### S0 — Full-screen mode: pinned composer + dedicated streaming region · impact: high · effort: high

**The "room to breathe" look, done the way the market actually converged on.** A full-screen (alternate-screen) layout: a scrolling transcript region with vertical space, a composer pinned at the bottom that never jumps, a persistent status bar, and zero flicker. Opt-in now (`ui.fullScreen`), auto-enabled on capable terminals, with **inline always the fallback** (`/tui default`).

Build approach (decided):

- **Hand-roll DEC 1049** (Path B) — not the Ink 7 upgrade — to decouple from a Node-22/React-19.2 bump. Bulletproof teardown on `process.exit`/SIGINT/SIGTERM/`uncaughtException`/`runExitCleanup` so a crash never strands the user on a blank alt-screen.
- **Generalize `TranscriptOverlay.tsx`** (already a working hand-rolled full-screen scroll viewport) into the default transcript region; fold pending/streaming items into the viewport; subtract the measured composer/status height (machinery already exists: `controlsHeight` via `measureElement` in `AppContainer.tsx:1027`).
- **True height-aware virtualization** (measure-then-slice the visible window) — _not_ clip-everything, which cliffs on long sessions. Highest-risk item; invest here early.
- **Auto-follow tail** state machine: pin to bottom while streaming, release on scroll-up, show "jump to latest ↓ (N new)", re-anchor on submit.
- **Selection & scroll — do NOT capture the mouse (decided 2026-06-29, after a 3-track due-diligence).** Full-screen leaves the mouse to the terminal, so its **native text selection + copy** just work (real selection, scrollback Find, tmux copy-mode, screen-reader selection all intact). Scroll is **PgUp/PgDn**. We built the Claude-Code-style app-level capture + reimplemented drag-select + highlight and **abandoned it**: Ink clears and rewrites the _whole_ alt-screen every commit (`height==rows` → `ansiEscapes.clearTerminal` branch in `ink.js`), so any `/dev/tty` highlight overlay is stomped on the next frame, and a clean Ink-level pause/freeze does not exist. The research also confirmed every TUI that captures the mouse (CC, Crush, opencode) inherits a long bug tail (clipboard spam, broken scrollback/Find/tmux, a11y) — even CC, which owns a real cell-grid renderer. Native selection _is_ the native-cursor experience, with zero highlight to render. Cost accepted: no mouse-wheel scroll of the virtual transcript (hence PgUp/PgDn), and no app-level drag features.
- **Capability detection:** default ON only on terminals with robust mouse + alt-screen; auto-fallback to inline elsewhere (Google's stated re-entry plan, learned from their revert).
- Reuses proto's existing manual synchronized-output (`\x1b[?2026`, `AppContainer.tsx:395`, `gemini.tsx:631`) to keep frames atomic.
- Files: `components/TranscriptOverlay.tsx` (seed), `components/MainContent.tsx` (the `<Static>` path to branch), `layouts/DefaultAppLayout.tsx`, `AppContainer.tsx`, `contexts/KeypressContext.tsx`, `gemini.tsx` (render site + lifecycle), `utils/cleanup.ts` (teardown), new `hooks/useFullScreen.ts` + `utils/altScreen.ts` + `utils/osc52.ts`.
- **Effort:** days for a flag-gated prototype (the viewport already exists); ~2–4 weeks for a production-quality default. Inline mode is never deleted — it's the fallback the drop-to-inline toggle returns to.

### S1 — Numbered approval modal with the diff inside it · impact: high · effort: medium

**The single highest trust-per-effort change.** Rebuild `ToolConfirmationMessage.tsx` into a numbered single-key modal with the diff rendered _inside_ the prompt:

```
  proto wants to edit src/auth/middleware.ts

  @@ inside verifyToken() @@
  - const token = req.headers.authorization
  + const token = req.headers.authorization?.replace(/^Bearer /, '')

  1. Yes  (y)
  2. Yes, and don't ask again for `edit src/auth/**`  (p)
  3. Allow for this session  (a)
  4. No, tell proto what to do differently  (esc → steering message)
```

- **350ms ignore-window** after the modal appears so an in-flight keystroke can't auto-approve a destructive edit (Crush). Kills the scariest failure mode.
- "Allow for session" + "don't ask again for prefix" tuple whitelisting (opencode/Codex).
- Green `✔ approved` history line after; option 4 routes the rejection straight into a steering message.
- Pure render + local-state change. No Ink-ceiling risk.
- Files: `components/messages/ToolConfirmationMessage.tsx`, `components/ApprovalModeDialog.tsx`.

### S2 — Word-level diff + function-scope headers + memoized highlight · impact: high · effort: medium

The single most-loved review feature in the git-native ecosystem (delta). `DiffRenderer.tsx` currently drops `hunk` rows (`:195-197`) and re-colorizes on every render.

- Word-level intra-line emphasis on matched del/add pairs (only the changed token gets a brighter bg over a subtle red/green wash — avoid the "kaleidoscope").
- Restore function-scope hunk headers (`@@ inside handleSubmit()`); boxed file header.
- Memoize highlighted output keyed by `content+width` (also fixes a real per-render perf cost).
- **Cut side-by-side mode** (Yoga alignment trap).
- Files: `components/messages/DiffRenderer.tsx`, `utils/CodeColorizer.ts`.

### S3 — One Shift+Tab autonomy dial + footer chip + Alt+M fallback · impact: high · effort: low

The #1 muscle-memory gesture in every 2026 power-user guide. proto has the pieces (`ApprovalModeDialog`, `AutoAcceptIndicator`, `RewindPicker`) but ships three gestures.

- Collapse to ONE `Shift+Tab` cycle: `default → acceptEdits → plan` (→ optional `auto`), with an always-visible footer chip in the same row as the `?` hint.
- `Alt+M` fallback for terminals that eat `Shift+Tab`. **Note the chord collision:** research also wanted `Alt+M` for raw/rendered markdown toggle — pick one, route the other, and add the startup conflict validator (see S6).
- Real Plan mode: a read-only planning turn ending in a numbered plan that waits.
- Files: `components/AutoAcceptIndicator.tsx`, `components/ApprovalModeDialog.tsx`, `hooks/useAutoAcceptIndicator.ts`, `components/Footer.tsx`.

### S4 — Steer & Queue (interrupt + resubmit-merge) · impact: high · effort: high

The most-loved interaction in Codex/Amp — makes the agent feel collaborative, not fire-and-forget.

- While streaming: **Enter** = steer (atomic interrupt → preserve partial assistant text + completed tool results → resubmit merged); **Tab** = queue a follow-up into a visible pending stack above the composer; footer hint swaps to "tab to queue message."
- `Esc` interrupts and **keeps** completed work; a second `Esc` force-sends.
- Model queue/steer/interrupt as ONE explicit state machine; never disable the interrupt affordance while it's shown (the `#16905`-class "still says esc to interrupt" bug).
- **Validate resubmit-merge against the ACP/acp-cron delegate path first** — it may force engine changes that precede the UI work.
- Files: `hooks/useGeminiStream.ts`, `components/InputPrompt.tsx`, `components/QueuedMessageDisplay.tsx`, `components/Composer.tsx`, `components/Footer.tsx`.

### S5 — Living status line · impact: high · effort: medium

- Cryptic gradient "Thinking" indicator (reshuffling glyph row, moving 2-stop gradient) — **FPS-capped and folded into the coalesced live-region frame, not its own timer** (two uncoordinated animation loops reintroduce flicker). Reduce-motion → static glyph; screen-reader → plain.
- Live "Thinking for Ns" counter + the existing elapsed/token/"esc to interrupt" meter.
- Configurable whimsical verb pack (`append|replace`, plain mode).
- Data-driven footer/status as an ordered token array (model · approval chip · context% · branch+dirty ✱ · cost · spinner) with semantic dots and a context-aware key-hint chain showing only currently-valid keys. **Pull this Footer refactor early** — S3's chip and any PR/cost pill depend on it.
- Gradient infra already exists (`ink-gradient ^3.0.0`, `gradientUtils.ts`).
- Files: `components/GeminiRespondingSpinner.tsx`, `components/LoadingIndicator.tsx`, `components/Footer.tsx`, `components/StatusBar.tsx`, `components/ContextUsageDisplay.tsx`.

### S6 — One command surface: Ctrl+K palette + which-key + generated help + remappable keys · impact: high · effort: high

Today the only discovery surface is the `/` dropdown; help drifts across four hand-maintained lists; despite a "data-driven for user configuration" comment, **not a single key is rebindable** (`keyMatchers.ts` exports a module-const built only from defaults; `createKeyMatchers(customConfig)` is defined but never called).

- `Ctrl+K` fuzzy palette over ALL actions — slash commands, every dialog, and chord-only actions (approval cycle, transcript, rewind, retry) — with inline key hints and live preview. Generalize `SuggestionsDisplay.tsx` into the reusable fuzzy-finder backing both `/` and `Ctrl+K`.
- Bottom-anchored timed which-key popup for chord prefixes (helix/which-key.nvim).
- Generate `/help`, the `?` strip, and docs from `config/keyBindings.ts` — kill the four-way drift.
- Wire `createKeyMatchers` to user settings → keys actually remappable.
- ONE central keymap dispatcher with an explicit context/focus stack (global → overlay → dialog → composer) replacing the ~6 always-on subscribers.
- **Startup `(context,key)` conflict validator** (catches the `Alt+M` and `Tab` collisions mechanically).
- Files: `config/keyBindings.ts`, `keyMatchers.ts`, `contexts/KeypressContext.tsx`, `hooks/useKeyboardHandling.ts`, `components/Help.tsx`, `components/KeyboardShortcuts.tsx`, `components/SuggestionsDisplay.tsx`.

### S7 — The Reactor: selector store · impact: high · effort: high

Move UI state out of `AppContainer`'s ~120-field `uiState` memo (`:1433`) into an external selector store (`useSyncExternalStore` / zustand-style). Leaves subscribe to slices — `streamingState`, `buffer`, `history`, `dialogs`, `footer` — so a streamed token or keystroke re-runs only the affected consumers.

- **Re-scoped claim:** this cuts per-token/per-keystroke **JS churn** in the dynamic region. It does **not** make "only the live region repaint" — Ink still does whole-frame Yoga+diff every commit. Do not sell it as differential rendering.
- Land behind the existing `UIStateContext`/`UIActionsContext` API so consumers don't change shape; migrate slice-by-slice against existing snapshot/Ink tests; keep `refreshStatic` semantics identical at first.
- Also: dedupe the two `onModelChange` effects (`AppContainer.tsx:330`, `:405`).
- Files: `AppContainer.tsx`, `contexts/UIStateContext.tsx`, `contexts/UIActionsContext.tsx`, `components/MainContent.tsx`.

### S8 — Inline LSP diagnostics fed back to the model · impact: high · effort: medium

**The highest-leverage pattern the field loves that proto lacks** (opencode). After every edit/write, show diagnostics inline (`path:line:col [source][code] message`) AND feed them back to the model so it self-corrects. This is the edit→error→fix trust loop. Pair with honest edit-failure UX (aider): when a search/replace doesn't match, the terse failure line expands to show the nearest fuzzy anchor as a mini-diff (don't just hide the reason).

### S9 — Adaptive "system" theme + semantic palette + gradient brand · impact: medium · effort: medium

- opencode-style adaptive theme: detect terminal background, generate a grayscale ramp, map accents onto ANSI 0-15, emit `none` for fg/bg so proto inherits the terminal (incl. transparency).
- Strictly-semantic tokens; remap raw ANSI from subprocess/shell output onto the proto palette so tool output never breaks the color language.
- Gradient ASCII logo; low-contrast warnings + colorblind-safe palettes in the theme dialog.
- Detection plumbing already exists: `themes/detect-terminal-theme.ts`, `color-utils.ts`, `semantic-tokens.ts`.

---

## Component change map

| File                                                      | Current                                                                                  | Proposed                                                                                                                                               | I/E   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `messages/ToolConfirmationMessage.tsx`                    | yes/no, no debounce, no embedded diff                                                    | Numbered single-key modal, inline diff, 350ms ignore-window, allow-for-session / prefix, reject→steer                                                  | H/M   |
| `messages/DiffRenderer.tsx`                               | unified-only, drops hunks (`:195-197`), recolors every render                            | Word-level emphasis, function-scope headers, boxed header, memoized by content+width; **no side-by-side**                                              | H/M   |
| `AutoAcceptIndicator` + `ApprovalModeDialog` + `Footer`   | three gestures                                                                           | One `Shift+Tab` dial + persistent chip + `Alt+M` fallback + Plan mode                                                                                  | H/L   |
| `hooks/useGeminiStream.ts`                                | `Esc`=cancel discards work; no steer/queue                                               | Steer(interrupt+resubmit-merge)/Queue state machine; `Esc` preserves partial+completed; coalesce setState to ~30-60fps; compact one-line drop-recovery | H/H   |
| `GeminiRespondingSpinner` + `LoadingIndicator`            | flat `dots` spinner                                                                      | FPS-capped gradient Thinking (in coalesced frame) + live counter + configurable verbs                                                                  | M/M-L |
| `Footer.tsx`                                              | imperative `rightItems[]`, `?` is the only hint                                          | Data-driven token array, semantic dots, autonomy chip, context-aware hint chain                                                                        | H/M   |
| `config/keyBindings.ts` + `keyMatchers.ts`                | sole source but help drifts; `createKeyMatchers` uncalled                                | Single generated source for help/which-key/`?`/docs; remappable via user settings                                                                      | M/M   |
| `contexts/KeypressContext.tsx` + `useKeyboardHandling.ts` | ~6 always-on subscribers; two ESC machines (1000ms global vs two 500ms in `InputPrompt`) | One dispatcher + context/focus stack; one ESC precedence + one timing constant                                                                         | H/H   |
| `SuggestionsDisplay.tsx`                                  | 8-row cap, single highlight                                                              | Reusable scored fuzzy-finder backing `/` and `Ctrl+K`                                                                                                  | M/M   |
| `AppContainer.tsx`                                        | 120-field memo (`:1433`), two `onModelChange` effects (`:330`,`:405`)                    | Selector store; dedupe effects; shrink to assembly/effects shell                                                                                       | H/H   |
| `components/InputPrompt.tsx`                              | 625-line `handleInput`; dead `selectionAnchor`; two ESC windows                          | `(mode,key)→command` dispatcher table; activate selection+copy; steer/queue bindings; auto-grow                                                        | H/H   |
| `components/shared/text-buffer.ts`                        | whole-buffer re-wrap per edit; whole-line undo snapshots                                 | **Targeted fixes only:** `Intl.Segmenter` in the width fn; coalesce undo by timestamp. **Not a rewrite.**                                              | M/M   |
| `utils/synchronizedOutput.ts`                             | DEC-2026 off under TMUX/SSH (`:51-53`); no fps cap                                       | Startup `?2026` probe (swallow reply) + always-emit fallback; pair with streaming throttle                                                             | H/M   |
| `hooks/useTerminalSize.ts`                                | no resize debounce                                                                       | Debounce + recompute wrap once on settle                                                                                                               | M/L   |
| `RewindPicker.tsx`                                        | buried command                                                                           | Promote to `Esc Esc`-on-empty; back with **local** per-edit snapshots (not user git history)                                                           | M/M   |

---

## Roadmap — value first

The recon's adversarial critic flipped the original ordering: do **not** front-load the scary refactors (selector store, keymap dispatcher, ESC merge) behind zero visible payoff. Ship render-layer wins first; run the refactors as independently-tested parallel tracks. **S0 (full-screen) is the one architecture-defining track and runs in parallel from the start, because the chrome work (composer, status bar, footer, tool cells) lands differently depending on which mode it targets — Wave 1's render-layer wins (S1–S3) are renderer-agnostic and ship regardless.**

**Track F — Full-screen mode (S0, parallel from day one)**

- F0 prototype: flag-gated `ui.fullScreen`, hand-rolled DEC 1049 + bulletproof teardown, `TranscriptOverlay` generalized into the default region (clip-everything is acceptable for the prototype only).
- F1 production viewport: true height-aware virtualization; auto-follow tail + "jump to latest ↓ (N new)"; pending/streaming items inside the viewport.
- F2 terminal citizenship: SGR `?1006` wheel parsing; OSC-52 yank; one-key drop-to-inline toggle; capability detection + auto-fallback.
- F3 default-on: enable by default on capable terminals once virtualization + copy are solid; inline stays the fallback.

**Wave 1 — ship value now (render-layer only, renderer-agnostic, no Ink-ceiling risk)**

- S1 numbered approval modal + inline diff
- S2 word-level diff + function-scope headers + memoized highlight
- S3 Shift+Tab autonomy dial + footer chip + Alt+M fallback
- S5 (partial) gradient Thinking spinner + verbs + live counter; data-driven Footer token array (pulled early — S3 depends on it)

**Wave 2 — the control loop (headline feel)**

- S4 steer/queue (interrupt+resubmit-merge) — _ACP path validated first_
- ESC unification — **write the per-meaning test matrix first** (interrupt / clear-draft / dismiss-completion / exit-shell / open-rewind), then delete the two old machines
- Promote `RewindPicker` to `Esc Esc`-on-empty with local snapshots
- S6 Ctrl+K palette + which-key + generated help + remappable keys + conflict validator

**Wave 3 — foundation (parallel track, independently tested)**

- S7 selector store (behind existing context API, slice-by-slice)
- Targeted `text-buffer.ts` fixes (grapheme width, undo coalescing) — _not_ a rewrite
- Probe-based synchronized output + streaming frame-rate cap + resize debounce

**Wave 4 — look + capability**

- S8 inline LSP diagnostics loop + honest edit-failure UX
- S9 adaptive "system" theme + semantic palette + gradient brand
- `Ctrl+O` transcript → less-style pager (`/` search, `n`/`N`, `[` dump to scrollback); live-region tool cells (dim bullets + "Explored" collapse)

**Spike — gated, not committed**

- Custom React reconciler / differential cell renderer — evaluate only if Wave 3 coalescing+sync proves measurably insufficient. Separate funded track. (Note: full-screen mode is no longer a spike — it's committed Track F above.)

---

## Explicitly rejected

| Idea                                                                                                               | Why not                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full-screen as a **hard default with no inline fallback or escape hatch**                                          | This — not full-screen itself — is what forced Gemini's ~2-week revert and drew CC's backlash. Full-screen is embraced (S0/Track F), but inline always stays reachable (`/tui default`) and capture always ships with OSC-52 + drop-to-inline.                                                                                                   |
| Rewrite on ratatui / OpenTUI (Zig/Rust)                                                                            | Throws away the entire React/Ink component tree for a months-long port. Claude Code proved you can keep React and replace only the renderer output. Pursue cheap wins first.                                                                                                                                                                     |
| Git-history-driven undo (`/undo` auto-commit)                                                                      | opencode's biggest reliability disaster — restored stale snapshots and corrupted git state. Back rewind with **local** snapshots; keep agent artifacts out of the working tree.                                                                                                                                                                  |
| Mouse capture anywhere (inline OR full-screen)                                                                     | Steals native text selection/copy (Codex #1247, Gemini backlash) and breaks scrollback Find / tmux copy-mode / a11y. **Reversed 2026-06-29:** full-screen used to capture for wheel-scroll + drag-copy (shipped v0.65.0); now it does NOT capture — native selection + PgUp/PgDn instead (see S0).                                               |
| App-level drag-selection + live highlight in full-screen (CC/Crush-style)                                          | Built and abandoned after 3 attempts + due-diligence. Ink rewrites the whole alt-screen every commit, so a `/dev/tty` highlight overlay is always stomped and there's no clean Ink pause; even CC (real cell-grid renderer) can't escape the capture bug-class. Native terminal selection delivers the native-cursor feel with zero render work. |
| Side-by-side diff mode                                                                                             | Yoga column-alignment trap; inline word-level emphasis wins ~90% of the value at a fraction of the risk.                                                                                                                                                                                                                                         |
| Mandatory whimsical spinner verbs                                                                                  | A vocal minority calls it "unprofessional." Ships default-on but trivially disabled; honors reduce-motion/screen-reader.                                                                                                                                                                                                                         |
| `incrementalRendering` flag, "reprint header only," pause-on-scroll in inline mode, "steer = live token injection" | Not physically possible in Ink 6 / the streaming APIs (see Ceiling). Cut or re-labeled.                                                                                                                                                                                                                                                          |

---

## Validation gates (before each wave merges)

- **Wave 1:** snapshot tests for the new modal/diff; verify the 350ms debounce blocks a queued keystroke from auto-approving; confirm `Shift+Tab` chip survives terminals that remap the chord (`Alt+M` path).
- **Wave 2:** the ESC per-meaning test matrix passes _before_ old handlers are deleted; steer/queue covered by integration tests **including the acp-cron path**; interrupt affordance never disabled while shown.
- **Wave 3:** existing Ink snapshot suite green after the store migration (consumer shapes unchanged); synchronized-output probe validated on tmux passthrough + VSCode terminal before defaulting on; `PROTO_DISABLE_SYNCHRONIZED_OUTPUT` honored.
- **All waves:** screen-reader layout (`ScreenReaderAppLayout`) renders a plain, non-animated path; reduce-motion honored.

## Open questions

1. **`Alt+M` ownership** — autonomy-dial fallback vs raw/rendered markdown toggle. Pick one; route the other.
2. **ACP steer semantics** — does interrupt+resubmit-merge need engine changes that should precede Wave 2 UI work? (Validate against acp-cron.)
3. **Scope of remappable keys** — full user keymap override, or a curated subset first?
4. **Verb packs** — ship a default proto verb pack, or plain-by-default with opt-in whimsy?
