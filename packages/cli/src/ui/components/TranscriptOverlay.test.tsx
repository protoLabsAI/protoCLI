/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { clampScroll } from './TranscriptOverlay.js';
import { keyMatchers, Command } from '../keyMatchers.js';
import type { Key } from '../hooks/useKeypress.js';

function key(partial: Partial<Key>): Key {
  return {
    name: '',
    ctrl: false,
    meta: false,
    shift: false,
    paste: false,
    sequence: '',
    ...partial,
  };
}

describe('clampScroll', () => {
  it('clamps below zero to zero', () => {
    expect(clampScroll(-5, 100)).toBe(0);
  });

  it('clamps above max to max', () => {
    expect(clampScroll(150, 100)).toBe(100);
  });

  it('passes through values within range', () => {
    expect(clampScroll(42, 100)).toBe(42);
  });

  it('handles a zero-height (non-scrollable) transcript', () => {
    expect(clampScroll(10, 0)).toBe(0);
    expect(clampScroll(-3, 0)).toBe(0);
  });
});

describe('TOGGLE_TRANSCRIPT binding', () => {
  it('matches Ctrl+O by name', () => {
    expect(
      keyMatchers[Command.TOGGLE_TRANSCRIPT](key({ name: 'o', ctrl: true })),
    ).toBe(true);
  });

  it('matches the raw SI control byte', () => {
    expect(
      keyMatchers[Command.TOGGLE_TRANSCRIPT](
        key({ sequence: '\x0f', ctrl: true }),
      ),
    ).toBe(true);
  });

  it('does not match a plain "o"', () => {
    expect(keyMatchers[Command.TOGGLE_TRANSCRIPT](key({ name: 'o' }))).toBe(
      false,
    );
  });
});
