/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { MIN_LOOP_INTERVAL_MS } from './types.js';

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const COMPACT_RE =
  /^\s*(\d+(?:\.\d+)?)\s*(s|m|h|d|sec|secs|min|mins|hr|hrs|day|days|second|seconds|minute|minutes|hour|hours)\s*$/i;

/**
 * Parse a duration token like `5m`, `30s`, `2h`, `1d` into milliseconds. Also
 * accepts the long forms (`5 minutes`, `2 hours`).
 *
 * Throws on unparseable input or values below the 60s minimum.
 */
export function parseInterval(token: string): number {
  if (!token || typeof token !== 'string') {
    throw new Error('Interval is required.');
  }

  const match = token.match(COMPACT_RE);
  if (!match) {
    throw new Error(
      `Could not parse interval "${token}". Use formats like 5m, 30m, 2h, or 1d.`,
    );
  }

  const value = Number(match[1]);
  const unit = normaliseUnit(match[2]);
  const ms = Math.round(value * UNIT_MS[unit]);

  if (ms < MIN_LOOP_INTERVAL_MS) {
    throw new Error(`Interval must be at least 60 seconds (got ${token}).`);
  }

  return ms;
}

/**
 * Try to parse an interval; returns null on failure rather than throwing. Used
 * by the CLI to detect "is the first argument an interval or part of the prompt?"
 */
export function tryParseInterval(token: string): number | null {
  try {
    return parseInterval(token);
  } catch {
    return null;
  }
}

/**
 * Render an interval back into a compact, human-readable token like `5m` or
 * `2h`. Picks the largest unit that produces an integer value.
 */
export function formatInterval(ms: number): string {
  for (const [label, factor] of [
    ['d', UNIT_MS['d']],
    ['h', UNIT_MS['h']],
    ['m', UNIT_MS['m']],
    ['s', UNIT_MS['s']],
  ] as const) {
    if (ms % factor === 0) return `${ms / factor}${label}`;
  }
  return `${Math.round(ms / UNIT_MS['s'])}s`;
}

function normaliseUnit(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.startsWith('s')) return 's';
  if (lower.startsWith('mi') || lower === 'm') return 'm';
  if (lower.startsWith('h')) return 'h';
  if (lower.startsWith('d')) return 'd';
  return lower;
}
