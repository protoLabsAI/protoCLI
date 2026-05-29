/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export { GoalManager } from './GoalManager.js';
export { evaluateGoal, parseEvaluatorJson } from './goalEvaluator.js';
export {
  summarizeToolCallsForGoal,
  MAX_ACTION_LINES,
  MAX_READ_LINES,
} from './toolCallSummary.js';
export {
  GOAL_CLEAR_ALIASES,
  GOAL_STALL_LIMIT,
  MAX_GOAL_CONDITION_LENGTH,
  type GoalClearAlias,
  type GoalEvaluationContext,
  type GoalEvaluationResult,
  type GoalState,
} from './types.js';
