/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Alternate-screen-buffer (DEC private mode 1049) lifecycle for full-screen mode.
 *
 * Full-screen mode draws on the terminal's alternate screen — the same surface
 * vim and htop use — so the conversation gets a clean, flicker-free canvas with
 * a pinned composer instead of streaming into the shell's scrollback.
 *
 * The rule that must never break: if the process leaves without emitting the
 * "leave alt-screen" sequence, the user is stranded on a blank alternate screen
 * with their shell hidden. So entering also installs a SYNCHRONOUS
 * `process.on('exit')` fallback, which fires on normal completion, on
 * `process.exit()`, and after an uncaught exception's default handler — the
 * paths that async cleanup (`runExitCleanup`) can miss. `leaveAltScreen()` is
 * also wired into the normal cleanup chain by the caller, so the common path
 * restores the screen *before* Ink unmounts; the `exit` handler is the
 * last-resort backstop.
 */

const ENTER_ALT_SCREEN = '\x1b[?1049h';
const LEAVE_ALT_SCREEN = '\x1b[?1049l';

let active = false;
let exitHandlerInstalled = false;

function writeSequence(seq: string): void {
  try {
    process.stdout.write(seq);
  } catch {
    // stdout can be torn down during shutdown; there is nothing to recover.
  }
}

/** Synchronous, last-resort teardown. Safe to call repeatedly. */
function leaveSync(): void {
  if (!active) return;
  active = false;
  writeSequence(LEAVE_ALT_SCREEN);
}

/**
 * Enter the alternate screen. No-op when stdout is not a TTY (piped/redirected
 * output) or when already active. Installs the synchronous `exit` backstop the
 * first time it is called.
 */
export function enterAltScreen(): void {
  if (active) return;
  if (!process.stdout.isTTY) return;
  active = true;
  writeSequence(ENTER_ALT_SCREEN);
  if (!exitHandlerInstalled) {
    exitHandlerInstalled = true;
    // Must stay synchronous — `exit` handlers cannot await.
    process.on('exit', leaveSync);
  }
}

/** Leave the alternate screen, restoring the user's shell and scrollback. */
export function leaveAltScreen(): void {
  leaveSync();
}

/** Whether proto is currently drawing on the alternate screen. */
export function isAltScreenActive(): boolean {
  return active;
}
