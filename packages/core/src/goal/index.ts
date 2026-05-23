/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export { GoalManager } from './GoalManager.js';
export { evaluateGoal, parseEvaluatorJson } from './goalEvaluator.js';
export {
  GOAL_CLEAR_ALIASES,
  MAX_GOAL_CONDITION_LENGTH,
  type GoalClearAlias,
  type GoalEvaluationContext,
  type GoalEvaluationResult,
  type GoalState,
} from './types.js';
