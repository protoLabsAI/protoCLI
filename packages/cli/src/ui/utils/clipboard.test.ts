/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildOsc52Sequence } from './clipboard.js';

describe('buildOsc52Sequence', () => {
  const originalTmux = process.env['TMUX'];

  beforeEach(() => {
    delete process.env['TMUX'];
  });

  afterEach(() => {
    if (originalTmux === undefined) delete process.env['TMUX'];
    else process.env['TMUX'] = originalTmux;
  });

  it('emits ESC ] 52 ; c ; <base64> BEL', () => {
    // base64('hello') === 'aGVsbG8='
    expect(buildOsc52Sequence('hello')).toBe('\x1b]52;c;aGVsbG8=\x07');
  });

  it('base64-encodes the UTF-8 bytes (not latin1)', () => {
    const seq = buildOsc52Sequence('café')!;
    const b64 = seq.slice('\x1b]52;c;'.length, -1);
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('café');
  });

  it('returns null for empty text', () => {
    expect(buildOsc52Sequence('')).toBeNull();
  });

  it('returns null for an oversized payload', () => {
    expect(buildOsc52Sequence('x'.repeat(80_000))).toBeNull();
  });

  it('wraps in tmux passthrough and doubles inner ESCs when inside tmux', () => {
    process.env['TMUX'] = '/tmp/tmux-1000/default,1234,0';
    const seq = buildOsc52Sequence('hi')!;
    expect(seq.startsWith('\x1bPtmux;')).toBe(true);
    expect(seq.endsWith('\x1b\\')).toBe(true);
    // The inner OSC ESC is doubled.
    expect(seq).toContain('\x1b\x1b]52;c;');
  });
});
