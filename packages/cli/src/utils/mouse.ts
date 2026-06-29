/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SGR mouse-reporting lifecycle for full-screen mode.
 *
 * The alternate screen has no native scrollback, so the wheel is dead unless we
 * ask the terminal to report mouse events. We enable button-event tracking (DEC
 * `?1002`, which reports press/release AND motion while a button is held — the
 * latter is what drag-selection needs) plus SGR extended coordinates (`?1006`).
 * Wheel notches arrive as `\x1b[<64;x;yM` (up) / `\x1b[<65;x;yM` (down); drags
 * arrive as press → motion(s) → release, all decoded in KeypressContext.
 *
 * Trade-off: capturing the mouse means the terminal hands click-drag to the app
 * instead of doing a native text selection. proto reimplements selection itself
 * (highlight + OSC-52 auto-copy) so copy is preserved — the Claude Code model.
 *
 * Like the alt-screen, this installs a synchronous `process.on('exit')` backstop
 * so a crash can't leave the terminal stuck in mouse-reporting mode (which would
 * spew `\x1b[<…` escapes into the user's shell on every wheel/click).
 */

const ENABLE_MOUSE = '\x1b[?1002h\x1b[?1006h';
const DISABLE_MOUSE = '\x1b[?1006l\x1b[?1002l';

let active = false;
let exitHandlerInstalled = false;

function writeSequence(seq: string): void {
  try {
    process.stdout.write(seq);
  } catch {
    // stdout can be torn down during shutdown; nothing to recover.
  }
}

/** Synchronous, last-resort teardown. Safe to call repeatedly. */
function disableSync(): void {
  if (!active) return;
  active = false;
  writeSequence(DISABLE_MOUSE);
}

/**
 * Enable SGR mouse reporting. No-op when stdout is not a TTY or already active.
 * Installs the synchronous `exit` backstop the first time it is called.
 */
export function enableMouse(): void {
  if (active) return;
  if (!process.stdout.isTTY) return;
  active = true;
  writeSequence(ENABLE_MOUSE);
  if (!exitHandlerInstalled) {
    exitHandlerInstalled = true;
    // Must stay synchronous — `exit` handlers cannot await.
    process.on('exit', disableSync);
  }
}

/** Disable SGR mouse reporting, restoring native selection/scroll. */
export function disableMouse(): void {
  disableSync();
}

/** Whether proto is currently capturing mouse events. */
export function isMouseActive(): boolean {
  return active;
}
