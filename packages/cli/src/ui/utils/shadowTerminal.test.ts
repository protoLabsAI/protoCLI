/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import pkg from '@xterm/headless';
import type { Terminal } from '@xterm/headless';
import {
  extractTextFromBuffer,
  extractTextFromLines,
} from './shadowTerminal.js';

const XTerminal = pkg.Terminal;

/** Build a headless terminal with `content` written (write is async). */
function makeTerminal(
  content: string,
  cols = 80,
  rows = 24,
): Promise<Terminal> {
  const term = new XTerminal({ cols, rows, allowProposedApi: true });
  return new Promise((resolve) => term.write(content, () => resolve(term)));
}

describe('extractTextFromBuffer', () => {
  it('extracts a substring within a single line', async () => {
    const term = await makeTerminal('hello world');
    expect(
      extractTextFromBuffer(term, { row: 0, col: 0 }, { row: 0, col: 4 }),
    ).toBe('hello');
    term.dispose();
  });

  it('extracts across multiple lines', async () => {
    const term = await makeTerminal('line1\r\nline2\r\nline3');
    expect(
      extractTextFromBuffer(term, { row: 0, col: 0 }, { row: 2, col: 4 }),
    ).toBe('line1\nline2\nline3');
    term.dispose();
  });

  it('trims trailing cell padding (blank tail of the row)', async () => {
    const term = await makeTerminal('hi');
    // Select well past the content into the blank tail.
    expect(
      extractTextFromBuffer(term, { row: 0, col: 0 }, { row: 0, col: 40 }),
    ).toBe('hi');
    term.dispose();
  });

  it('normalizes drag direction (up-drag reads the same as down-drag)', async () => {
    const term = await makeTerminal('hello world');
    const down = extractTextFromBuffer(
      term,
      { row: 0, col: 0 },
      { row: 0, col: 4 },
    );
    const up = extractTextFromBuffer(
      term,
      { row: 0, col: 4 },
      { row: 0, col: 0 },
    );
    expect(up).toBe(down);
    expect(up).toBe('hello');
    term.dispose();
  });

  it('keeps interior spaces but trims the trailing tail', async () => {
    const term = await makeTerminal('a b c');
    expect(
      extractTextFromBuffer(term, { row: 0, col: 0 }, { row: 0, col: 40 }),
    ).toBe('a b c');
    term.dispose();
  });
});

describe('extractTextFromLines', () => {
  it('extracts a substring within a single line', () => {
    expect(
      extractTextFromLines(
        ['hello world'],
        { row: 0, col: 0 },
        { row: 0, col: 4 },
      ),
    ).toBe('hello');
  });

  it('extracts across multiple lines', () => {
    expect(
      extractTextFromLines(
        ['line1', 'line2', 'line3'],
        { row: 0, col: 0 },
        { row: 2, col: 4 },
      ),
    ).toBe('line1\nline2\nline3');
  });

  it('trims trailing padding from snapshot rows', () => {
    expect(
      extractTextFromLines(
        ['hi          '],
        { row: 0, col: 0 },
        { row: 0, col: 11 },
      ),
    ).toBe('hi');
  });

  it('normalizes drag direction', () => {
    expect(
      extractTextFromLines(['hello'], { row: 0, col: 4 }, { row: 0, col: 0 }),
    ).toBe('hello');
  });
});
