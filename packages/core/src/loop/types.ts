/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimum interval enforced by /loop. Mirrors Claude Code's 1-minute floor
 * and matches the cron scheduler's 1-minute granularity.
 */
export const MIN_LOOP_INTERVAL_MS = 60 * 1000;

/**
 * Default interval used when /loop is invoked without an interval token.
 */
export const DEFAULT_LOOP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Argument tokens that stop / cancel all active loops. Accepted by
 * `/loop <token>`.
 */
export const LOOP_STOP_ALIASES = ['stop', 'off', 'clear', 'cancel'] as const;

export type LoopStopAlias = (typeof LOOP_STOP_ALIASES)[number];
