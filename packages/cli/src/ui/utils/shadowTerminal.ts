/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import pkg from '@xterm/headless';
import type { Terminal } from '@xterm/headless';

const XTerminal = pkg.Terminal;

/**
 * A "shadow terminal" for full-screen mode: a hidden `@xterm/headless` emulator
 * fed the exact byte stream Ink writes to stdout, so it maintains the same
 * row/col cell grid the real terminal shows. Ink renders through Yoga and never
 * exposes a cell grid, so this is how we map a mouse drag back to the text under
 * it (for drag-to-select + copy). It mirrors the pattern proto already uses for
 * shell output in core's shellExecutionService.
 *
 * The emulator is a state machine over the byte stream, so it stays in sync
 * whether Ink writes full frames or incremental erase-line diffs, and it tracks
 * the alternate screen (`\x1b[?1049h`) automatically. The one caveat: a freshly
 * started shadow only sees writes from `start()` onward, so to read a complete
 * screen the caller should force a full repaint after starting (handled by the
 * selection layer, not here).
 */

/** A cell coordinate in the visible grid: row/col are 0-based, screen-relative. */
export interface GridPos {
  row: number;
  col: number;
}

let shadow: Terminal | null = null;
let restoreWrite: (() => void) | null = null;
let resizeListener: (() => void) | null = null;

/**
 * Extract the text covered by a linear (text-flow) selection from a terminal's
 * active buffer. Handles the cell-grid gotchas: trailing per-row padding is
 * trimmed, the empty continuation cell of a wide (CJK) glyph is skipped, and the
 * drag direction is normalized so dragging up reads the same as dragging down.
 * Exported for unit testing against a directly-fed terminal.
 */
export function extractTextFromBuffer(
  terminal: Terminal,
  a: GridPos,
  b: GridPos,
): string {
  const forward = a.row < b.row || (a.row === b.row && a.col <= b.col);
  const start = forward ? a : b;
  const end = forward ? b : a;

  const buffer = terminal.buffer.active;
  const cols = terminal.cols;
  const lines: string[] = [];

  for (let row = start.row; row <= end.row; row++) {
    const line = buffer.getLine(row);
    if (!line) {
      lines.push('');
      continue;
    }
    const fromCol = row === start.row ? start.col : 0;
    const toCol = row === end.row ? end.col : cols - 1;

    let text = '';
    for (let col = fromCol; col <= toCol && col < cols; col++) {
      const cell = line.getCell(col);
      if (!cell) continue;
      // A wide glyph occupies two columns; its second column is an empty
      // continuation cell (width 0) — skip it so we don't add a stray blank.
      if (cell.getWidth() === 0) continue;
      text += cell.getChars() || ' ';
    }
    // Trim trailing cell padding so we copy content, not the row's blank tail.
    lines.push(text.replace(/\s+$/u, ''));
  }

  return lines.join('\n');
}

/**
 * Start mirroring stdout into a hidden emulator sized to the current terminal.
 * Idempotent. Tees the CURRENT stdout.write (i.e. on top of the erase-line
 * optimizer) so the shadow sees the same writes the terminal does.
 */
export function startShadowTerminal(): void {
  if (shadow) return;
  if (!process.stdout.isTTY) return;

  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  shadow = new XTerminal({
    cols,
    rows,
    allowProposedApi: true,
    scrollback: 5000,
  });

  const stdout = process.stdout;
  const previousWrite = stdout.write.bind(stdout) as typeof stdout.write;
  const teeWrite = function (
    this: NodeJS.WriteStream,
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
    cb?: (error?: Error | null) => void,
  ): boolean {
    if (shadow && (typeof chunk === 'string' || chunk instanceof Uint8Array)) {
      try {
        shadow.write(chunk);
      } catch {
        // Never let mirroring break real output.
      }
    }
    return previousWrite(chunk as string, encodingOrCb as BufferEncoding, cb);
  } as typeof stdout.write;

  stdout.write = teeWrite;
  restoreWrite = () => {
    if (stdout.write === teeWrite) stdout.write = previousWrite;
  };

  resizeListener = () => {
    shadow?.resize(process.stdout.columns || 80, process.stdout.rows || 24);
  };
  process.stdout.on('resize', resizeListener);
}

/** Stop mirroring and dispose the emulator. Idempotent. */
export function stopShadowTerminal(): void {
  if (resizeListener) {
    process.stdout.removeListener('resize', resizeListener);
    resizeListener = null;
  }
  if (restoreWrite) {
    restoreWrite();
    restoreWrite = null;
  }
  shadow?.dispose();
  shadow = null;
}

/**
 * Read the text under a linear selection from the live shadow grid. Awaits a
 * write flush first, because `@xterm/headless` parses writes asynchronously —
 * reading immediately after a write would race a stale grid.
 */
export async function readShadowSelection(
  a: GridPos,
  b: GridPos,
): Promise<string> {
  const term = shadow;
  if (!term) return '';
  await new Promise<void>((resolve) => term.write('', () => resolve()));
  return extractTextFromBuffer(term, a, b);
}

/**
 * Snapshot every visible row as a full-width string (untrimmed, so column
 * indices line up). Used to freeze the screen at drag-start: the same snapshot
 * backs both the highlight render and the copied text, so they always agree.
 */
export async function snapshotShadowLines(): Promise<string[]> {
  const term = shadow;
  if (!term) return [];
  await new Promise<void>((resolve) => term.write('', () => resolve()));
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let row = 0; row < term.rows; row++) {
    const line = buffer.getLine(row);
    lines.push(line ? line.translateToString(false) : '');
  }
  return lines;
}

/**
 * Extract the text of a linear selection from snapshot rows (see
 * {@link snapshotShadowLines}). Same shape as {@link extractTextFromBuffer} but
 * over plain strings; trailing per-row padding is trimmed. (Column = string
 * index, which holds for the common ASCII case; wide-char precision is a
 * follow-up.)
 */
export function extractTextFromLines(
  lines: string[],
  a: GridPos,
  b: GridPos,
): string {
  const forward = a.row < b.row || (a.row === b.row && a.col <= b.col);
  const start = forward ? a : b;
  const end = forward ? b : a;

  const out: string[] = [];
  for (let row = start.row; row <= end.row; row++) {
    const line = lines[row] ?? '';
    const fromCol = row === start.row ? start.col : 0;
    const toCol = row === end.row ? end.col : line.length - 1;
    out.push(line.slice(fromCol, toCol + 1).replace(/\s+$/u, ''));
  }
  return out.join('\n');
}

/** Whether the shadow terminal is currently mirroring (for tests/diagnostics). */
export function isShadowTerminalActive(): boolean {
  return shadow !== null;
}
