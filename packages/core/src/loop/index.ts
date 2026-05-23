/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  parseInterval,
  tryParseInterval,
  formatInterval,
} from './intervalParser.js';
export {
  intervalToCron,
  intervalMsToCron,
  type IntervalToCronResult,
} from './intervalToCron.js';
export {
  LOOP_STOP_ALIASES,
  MIN_LOOP_INTERVAL_MS,
  DEFAULT_LOOP_INTERVAL_MS,
  type LoopStopAlias,
} from './types.js';
