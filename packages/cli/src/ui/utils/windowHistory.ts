/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cap how many history items the full-screen transcript renders at once.
 *
 * Ink re-lays-out the entire element tree on every frame, so the cost scales
 * with the number of rendered items. The inline renderer sidesteps this with
 * `<Static>` (committed items are never re-laid-out), but the alternate screen
 * has no scrollback to commit into, so full-screen mode must render its own
 * viewport — and rendering an unbounded history makes long sessions janky (the
 * "render-everything-and-clip" cliff).
 *
 * So full-screen renders only the most recent `maxItems`; older items stay
 * reachable through the Ctrl+O transcript pager, which renders the complete
 * history. Sessions at or under the cap are returned unchanged (same array
 * reference) — zero behavior change for the common case.
 */
export interface HistoryWindow<T> {
  /** The items to render (the most recent `maxItems`, or all of them). */
  windowed: T[];
  /** How many older items were trimmed off the front (0 when nothing trimmed). */
  olderCount: number;
}

export function windowHistory<T>(
  items: T[],
  maxItems: number,
): HistoryWindow<T> {
  if (maxItems <= 0 || items.length <= maxItems) {
    return { windowed: items, olderCount: 0 };
  }
  const windowed = items.slice(-maxItems);
  return { windowed, olderCount: items.length - windowed.length };
}
