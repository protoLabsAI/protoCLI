/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDebugLogger } from '../utils/debugLogger.js';
import {
  MAX_GOAL_CONDITION_LENGTH,
  type GoalEvaluationResult,
  type GoalState,
} from './types.js';

const debugLogger = createDebugLogger('GOAL_MANAGER');

/**
 * Session-scoped goal state. One goal can be active at a time; setting a new
 * goal replaces the previous one. The previous achieved goal (if any) is kept
 * so `/goal` with no args can report on it after success.
 */
export class GoalManager {
  private active: GoalState | undefined;
  private lastAchieved: GoalState | undefined;

  /**
   * Set a new goal. Replaces any active goal. Returns the created state.
   * Throws if the condition is empty or exceeds the length limit.
   */
  setGoal(condition: string): GoalState {
    const trimmed = condition.trim();
    if (!trimmed) {
      throw new Error('Goal condition cannot be empty.');
    }
    if (trimmed.length > MAX_GOAL_CONDITION_LENGTH) {
      throw new Error(
        `Goal condition exceeds ${MAX_GOAL_CONDITION_LENGTH} characters.`,
      );
    }

    if (this.active) {
      debugLogger.info(
        `Replacing active goal "${truncate(this.active.condition, 40)}" with "${truncate(trimmed, 40)}".`,
      );
    }

    this.active = {
      condition: trimmed,
      startedAt: Date.now(),
      turnCount: 0,
      tokensSpent: 0,
    };
    return this.active;
  }

  /**
   * Clear the active goal without marking it achieved. Returns the cleared
   * state if one was active.
   */
  clearGoal(): GoalState | undefined {
    if (!this.active) return undefined;
    const cleared = this.active;
    this.active = undefined;
    debugLogger.info(
      `Cleared goal "${truncate(cleared.condition, 60)}" after ${cleared.turnCount} turns.`,
    );
    return cleared;
  }

  /**
   * Mark the active goal as achieved and move it to `lastAchieved`. Returns
   * the achieved record. No-op if no goal is active.
   */
  markAchieved(): GoalState | undefined {
    if (!this.active) return undefined;
    const achieved: GoalState = {
      ...this.active,
      achievedAt: Date.now(),
    };
    this.lastAchieved = achieved;
    this.active = undefined;
    debugLogger.info(
      `Goal achieved after ${achieved.turnCount} turns: "${truncate(achieved.condition, 60)}".`,
    );
    return achieved;
  }

  /** Record that the agent completed a turn while the goal was active. */
  recordTurn(): void {
    if (this.active) {
      this.active = { ...this.active, turnCount: this.active.turnCount + 1 };
    }
  }

  /** Record the result of an evaluation against the active goal. */
  recordEvaluation(result: GoalEvaluationResult): void {
    if (!this.active) return;
    this.active = {
      ...this.active,
      lastReason: result.reason,
      tokensSpent: this.active.tokensSpent + result.tokensUsed,
    };
  }

  hasActiveGoal(): boolean {
    return this.active !== undefined;
  }

  getActiveGoal(): GoalState | undefined {
    return this.active ? { ...this.active } : undefined;
  }

  getLastAchievedGoal(): GoalState | undefined {
    return this.lastAchieved ? { ...this.lastAchieved } : undefined;
  }

  /** Reset both active and achieved state. Used on session clear/end. */
  reset(): void {
    this.active = undefined;
    this.lastAchieved = undefined;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
