/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { Text, useIsScreenReaderEnabled } from 'ink';
import { theme } from '../semantic-colors.js';
import { getRenderableGradientColors } from '../utils/gradientUtils.js';
import { SCREEN_READER_RESPONDING } from '../textConstants.js';

/**
 * A small "thinking" indicator: a short braille wave whose cells shimmer with a
 * moving 2-stop gradient (the active theme's brand gradient). Glyph wave AND
 * gradient phase are driven by ONE timer — the spec's hard rule, since a second
 * uncoordinated animation loop reintroduces flicker. Screen-reader mode renders
 * plain text; `PROTO_REDUCE_MOTION` (or screen-reader) freezes it to a static
 * shimmer.
 */

const WAVE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const WIDTH = 3;
// Phase between adjacent cells, so the wave appears to flow across the row.
const CELL_PHASE = 3;
// ~11 fps — fast enough to read as motion, slow enough to stay calm. This
// interval is the FPS cap; there is exactly one of them.
const FRAME_MS = 90;
// How fast the gradient slides along the row, in cells per frame.
const GRADIENT_SPEED = 0.12;

const REDUCE_MOTION = process.env['PROTO_REDUCE_MOTION'] === '1';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(color: string): Rgb | null {
  if (typeof color !== 'string' || color[0] !== '#') return null;
  let h = color.slice(1);
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Triangle wave mapping any real to [0,1] and back, for a seamless loop. */
export function pingPong(t: number): number {
  const x = ((t % 1) + 1) % 1;
  return x < 0.5 ? x * 2 : (1 - x) * 2;
}

/**
 * Interpolate the two gradient stops at position `t`. Falls back to picking the
 * nearer stop when the stops aren't hex (named ANSI colors can't be blended),
 * so themes like the `ansi` palette still shimmer (just in two steps).
 */
export function colorAt(stops: string[], t: number): string {
  if (stops.length < 2) return stops[0];
  const tt = pingPong(t);
  const a = parseHex(stops[0]);
  const b = parseHex(stops[1]);
  if (!a || !b) return tt < 0.5 ? stops[0] : stops[1];
  return toHex({
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt,
  });
}

interface ThinkingSpinnerProps {
  altText?: string;
}

export const ThinkingSpinner: React.FC<ThinkingSpinnerProps> = ({
  altText = SCREEN_READER_RESPONDING,
}) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  const [frame, setFrame] = useState(0);
  const animate = !isScreenReaderEnabled && !REDUCE_MOTION;

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % 100000), FRAME_MS);
    return () => clearInterval(id);
  }, [animate]);

  if (isScreenReaderEnabled) {
    return <Text>{altText}</Text>;
  }

  const stops = getRenderableGradientColors(theme.ui.gradient, [
    theme.text.accent,
    theme.text.primary,
  ]) ?? [theme.text.accent];

  const cells = [];
  for (let i = 0; i < WIDTH; i++) {
    const glyph = animate
      ? WAVE[(frame + i * CELL_PHASE) % WAVE.length]
      : WAVE[(i * CELL_PHASE) % WAVE.length];
    const t = (animate ? frame * GRADIENT_SPEED : 0) + i / WIDTH;
    cells.push(
      <Text key={i} color={colorAt(stops, t)}>
        {glyph}
      </Text>,
    );
  }
  return <Text>{cells}</Text>;
};
