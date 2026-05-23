/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import type { Config, GoalState } from '@qwen-code/qwen-code-core';

/**
 * Snapshot of the active /goal — used by the footer pill to render the
 * indicator. Null when no goal is set.
 */
export interface GoalStatusSnapshot {
  condition: string;
  turnCount: number;
  startedAt: number;
}

/**
 * Polls the session-scoped GoalManager every 500ms and returns a snapshot of
 * the active goal (or null). Mirrors `useSessionMemoryStatus` — the goal
 * state changes only when `/goal` is set/cleared or the evaluator fires after
 * a turn, so 500ms is plenty responsive without burning renders.
 *
 * Returns `null` while no goal is active so callers can short-circuit
 * rendering with a falsy check.
 */
export function useGoalStatus(
  config: Config | null,
): GoalStatusSnapshot | null {
  const [snapshot, setSnapshot] = useState<GoalStatusSnapshot | null>(null);

  useEffect(() => {
    if (!config) return;
    const manager = config.getGoalManager?.();
    if (!manager) return;

    const tick = () => {
      const active = manager.getActiveGoal();
      if (!active) {
        setSnapshot((prev) => (prev === null ? prev : null));
        return;
      }
      setSnapshot((prev) => {
        // Skip the React update when nothing the pill cares about changed --
        // shallow compare the three fields we render.
        if (
          prev !== null &&
          prev.condition === active.condition &&
          prev.turnCount === active.turnCount &&
          prev.startedAt === active.startedAt
        ) {
          return prev;
        }
        return {
          condition: active.condition,
          turnCount: active.turnCount,
          startedAt: active.startedAt,
        };
      });
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [config]);

  return snapshot;
}

// Re-export the upstream type so callers don't need a second import.
export type { GoalState };
