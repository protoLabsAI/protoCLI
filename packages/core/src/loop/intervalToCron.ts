/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseInterval } from './intervalParser.js';

/**
 * Result of converting a user-supplied interval token to a cron expression.
 */
export interface IntervalToCronResult {
  /** The 5-field cron expression. */
  cron: string;
  /** Human-readable description of the resolved cadence (for echo to user). */
  description: string;
  /** True if the requested interval was rounded to the nearest clean cron step. */
  rounded: boolean;
}

/**
 * Convert a duration token like `5m`, `2h`, `1d` into a 5-field cron expression
 * suitable for `CronScheduler.create`. Throws on values that can't be parsed
 * or are below the 60-second minimum.
 *
 * Mapping (mirrors the bundled loop skill):
 *
 * | Pattern              | Cron                  | Notes                                  |
 * | -------------------- | --------------------- | -------------------------------------- |
 * | `Nm` where N ≤ 59    | `*\/N * * * *`        | every N minutes                        |
 * | `Nm` where N ≥ 60    | `0 *\/H * * *`        | rounded to whole hours (H = N/60)      |
 * | `Nh` where N ≤ 23    | `0 *\/N * * *`        | every N hours                          |
 * | `Nd`                 | `0 0 *\/N * *`        | midnight every N days                  |
 * | `Ns`                 | round up to nearest m | cron granularity is 1 minute           |
 *
 * For minute or hour values that don't cleanly divide their unit (e.g. `7m`,
 * `90m`), the function picks the nearest clean step and sets `rounded: true`
 * so the caller can warn the user.
 */
export function intervalToCron(token: string): IntervalToCronResult {
  const ms = parseInterval(token);
  return intervalMsToCron(ms);
}

/**
 * Same as `intervalToCron` but accepts a pre-parsed millisecond value.
 */
export function intervalMsToCron(ms: number): IntervalToCronResult {
  const minutes = Math.max(1, Math.round(ms / 60_000));

  if (minutes <= 59) {
    const step = pickCleanDivisor(60, minutes);
    return {
      cron: `*/${step} * * * *`,
      description: `every ${step} minute${step === 1 ? '' : 's'}`,
      rounded: step !== minutes,
    };
  }

  const hours = Math.round(minutes / 60);
  if (hours <= 23) {
    const step = pickCleanDivisor(24, hours);
    return {
      cron: `0 */${step} * * *`,
      description: `every ${step} hour${step === 1 ? '' : 's'}`,
      rounded: step !== hours || minutes !== hours * 60,
    };
  }

  const days = Math.round(hours / 24);
  return {
    cron: `0 0 */${days} * *`,
    description: `every ${days} day${days === 1 ? '' : 's'} at midnight`,
    rounded: days !== hours / 24,
  };
}

/**
 * Pick the divisor of `total` closest to `target`. Cron `*\/N` only produces
 * even gaps when N divides the period (60 for minutes, 24 for hours), so we
 * round to the nearest clean step rather than emitting a misleading cron.
 */
function pickCleanDivisor(total: number, target: number): number {
  if (target <= 0) return 1;
  if (target >= total) return total;
  let best = 1;
  let bestDiff = Math.abs(target - 1);
  for (let n = 1; n <= total; n++) {
    if (total % n !== 0) continue;
    const diff = Math.abs(target - n);
    if (diff < bestDiff) {
      best = n;
      bestDiff = diff;
    }
  }
  return best;
}
