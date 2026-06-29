/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { openSync, writeSync, closeSync } from 'node:fs';
import { copyToClipboard } from './commandUtils.js';

// OSC-52 sequences are capped (~100KB on the wire); 74KB of text is the safe
// payload after base64. Guard so a huge selection doesn't get silently mangled.
const MAX_OSC52_TEXT_BYTES = 74_000;

// eslint-disable-next-line no-control-regex
const ESC_RE = /\x1b/g;

/**
 * Build an OSC-52 "set clipboard" escape for `text`, or null if too large.
 *
 * Encodes the **UTF-8 bytes** as base64 (encoding as latin1 was Claude Code's
 * CJK/Cyrillic corruption bug), always uses the `c` (clipboard) selection with a
 * non-empty payload marker (`;c;`) since some terminals reject an empty
 * selection under tmux, and wraps in tmux passthrough when inside tmux.
 */
export function buildOsc52Sequence(text: string): string | null {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length === 0 || bytes.length > MAX_OSC52_TEXT_BYTES) return null;
  const base64 = bytes.toString('base64');
  const inner = `\x1b]52;c;${base64}\x07`;
  // Inside tmux, wrap in a passthrough DCS and double the inner ESCs.
  return process.env['TMUX']
    ? `\x1bPtmux;${inner.replace(ESC_RE, '\x1b\x1b')}\x1b\\`
    : inner;
}

/**
 * Write `seq` to the controlling terminal. Prefers /dev/tty over process.stdout
 * because multiplexers (tmux/Zellij) intercept OSC-52 on the app's stdout and
 * never forward it (opencode's "the toast is a lie" bug) — /dev/tty reaches the
 * real terminal.
 */
function writeToTty(seq: string): boolean {
  try {
    const fd = openSync('/dev/tty', 'w');
    try {
      writeSync(fd, seq);
    } finally {
      closeSync(fd);
    }
    return true;
  } catch {
    try {
      process.stdout.write(seq);
      return true;
    } catch {
      return false;
    }
  }
}

/** Copy `text` to the system clipboard via OSC-52 (remote/multiplexer-safe). */
export function copyViaOsc52(text: string): boolean {
  const seq = buildOsc52Sequence(text);
  if (!seq) return false;
  return writeToTty(seq);
}

/**
 * Copy selected text using BOTH paths, like Claude Code and Crush: OSC-52 (the
 * only thing that works over SSH / through a multiplexer) and the native
 * clipboard tool (the reliable local path). Best-effort — never throws.
 */
export async function copySelection(text: string): Promise<boolean> {
  const viaOsc52 = copyViaOsc52(text);
  let viaNative = false;
  try {
    await copyToClipboard(text);
    viaNative = true;
  } catch {
    // Native tool may be unavailable (e.g. no xclip); OSC-52 may still have won.
  }
  return viaOsc52 || viaNative;
}
