/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ThinkingSpinner, colorAt, pingPong } from './ThinkingSpinner.js';

describe('pingPong', () => {
  it('forms a triangle wave that loops seamlessly', () => {
    expect(pingPong(0)).toBeCloseTo(0);
    expect(pingPong(0.25)).toBeCloseTo(0.5);
    expect(pingPong(0.5)).toBeCloseTo(1);
    expect(pingPong(0.75)).toBeCloseTo(0.5);
    // Loops: 1 maps back to 0 like the start.
    expect(pingPong(1)).toBeCloseTo(pingPong(0));
    // Negative inputs are normalized.
    expect(pingPong(-0.25)).toBeCloseTo(0.5);
  });
});

describe('colorAt', () => {
  it('interpolates between two hex stops', () => {
    // Midpoint of black→white is mid-grey.
    expect(colorAt(['#000000', '#ffffff'], 0.25)).toBe('#808080');
    // Endpoints (pingPong(0)=0, pingPong(0.5)=1).
    expect(colorAt(['#000000', '#ffffff'], 0)).toBe('#000000');
    expect(colorAt(['#000000', '#ffffff'], 0.5)).toBe('#ffffff');
  });

  it('expands 3-digit hex stops', () => {
    expect(colorAt(['#000', '#fff'], 0.5)).toBe('#ffffff');
  });

  it('falls back to the nearer stop for non-hex (named) colors', () => {
    expect(colorAt(['cyan', 'green'], 0.1)).toBe('cyan'); // pingPong→~0.2 < 0.5
    expect(colorAt(['cyan', 'green'], 0.4)).toBe('green'); // pingPong→~0.8 ≥ 0.5
  });

  it('returns the sole stop when only one is available', () => {
    expect(colorAt(['#123456'], 0.3)).toBe('#123456');
  });
});

describe('<ThinkingSpinner />', () => {
  it('renders a row of braille wave glyphs', () => {
    const { lastFrame } = render(<ThinkingSpinner />);
    const frame = lastFrame() ?? '';
    // The 3-cell wave uses braille glyphs from the U+2800 block.
    const brailleCount = [...frame].filter(
      (ch) => ch >= '⠀' && ch <= '⣿',
    ).length;
    expect(brailleCount).toBe(3);
  });
});
