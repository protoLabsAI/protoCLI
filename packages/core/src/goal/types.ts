/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Maximum length of a goal condition. Mirrors Claude Code's `/goal` limit.
 */
export const MAX_GOAL_CONDITION_LENGTH = 4000;

/**
 * Argument tokens that clear an active goal. Accepted by `/goal <token>`.
 */
export const GOAL_CLEAR_ALIASES = [
  'clear',
  'stop',
  'off',
  'reset',
  'none',
  'cancel',
] as const;

export type GoalClearAlias = (typeof GOAL_CLEAR_ALIASES)[number];

export interface GoalState {
  /** The condition the agent is working toward. */
  condition: string;
  /** Unix-ms timestamp when the goal was set. */
  startedAt: number;
  /** Number of turns evaluated since the goal was set. */
  turnCount: number;
  /** The most recent evaluator reason (why the goal is or is not met). */
  lastReason?: string;
  /** Tokens spent on goal evaluation (excludes main-turn tokens). */
  tokensSpent: number;
  /** Unix-ms timestamp when the goal was achieved. Unset on active goals. */
  achievedAt?: number;
}

export interface GoalEvaluationContext {
  /** The user's completion condition. */
  condition: string;
  /** Plain-text summary of the most recent tool calls. */
  toolCallSummary: string;
  /** The final assistant message from the most recent turn. */
  lastAssistantMessage: string;
}

export interface GoalEvaluationResult {
  /** Whether the evaluator considers the condition satisfied. */
  met: boolean;
  /** Short reason supporting the decision. */
  reason: string;
  /** Tokens consumed by the evaluator call. */
  tokensUsed: number;
}
