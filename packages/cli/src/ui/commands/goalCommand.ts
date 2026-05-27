/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MessageActionReturn,
  SlashCommand,
  SubmitPromptActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  GOAL_CLEAR_ALIASES,
  MAX_GOAL_CONDITION_LENGTH,
  type GoalManager,
} from '@qwen-code/qwen-code-core';

const CLEAR_TOKENS = new Set<string>(GOAL_CLEAR_ALIASES);

/**
 * `/goal <condition>` — set a completion condition. Claude keeps working
 * turn after turn until a small fast model confirms the condition holds.
 * `/goal` with no args reports status; `/goal clear` (or stop/off/reset/none/cancel)
 * removes the active goal.
 */
export const goalCommand: SlashCommand = {
  name: 'goal',
  description:
    'set a completion condition; keep working until it holds (or "/goal clear" to cancel)',
  kind: CommandKind.BUILT_IN,
  action: async (
    context,
    args,
  ): Promise<MessageActionReturn | SubmitPromptActionReturn | void> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Goal command requires an initialised config.',
      };
    }

    const manager = config.getGoalManager();
    const trimmed = args.trim();

    // /goal — status
    if (!trimmed) {
      return {
        type: 'message',
        messageType: 'info',
        content: statusText(manager),
      };
    }

    // /goal clear (+ aliases)
    if (CLEAR_TOKENS.has(trimmed.toLowerCase())) {
      const cleared = manager.clearGoal();
      return {
        type: 'message',
        messageType: 'info',
        content: cleared
          ? `Cleared goal after ${cleared.turnCount} turn(s): "${cleared.condition}"`
          : 'No active goal to clear.',
      };
    }

    // /goal <condition> — set + fire first turn
    if (trimmed.length > MAX_GOAL_CONDITION_LENGTH) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Goal condition exceeds ${MAX_GOAL_CONDITION_LENGTH} characters (got ${trimmed.length}).`,
      };
    }

    try {
      manager.setGoal(trimmed);
    } catch (err) {
      return {
        type: 'message',
        messageType: 'error',
        content: err instanceof Error ? err.message : String(err),
      };
    }

    // The condition itself is the directive for the first turn.
    return { type: 'submit_prompt', content: trimmed };
  },
};

export function statusText(manager: GoalManager): string {
  const active = manager.getActiveGoal();
  if (active) {
    const elapsed = formatElapsed(Date.now() - active.startedAt);
    const lines = [
      `Active goal (running ${elapsed}, ${active.turnCount} turn(s), ${active.tokensSpent} eval tokens):`,
      `  ${active.condition}`,
    ];
    if (active.lastReason) {
      lines.push(`Last evaluator reason: ${active.lastReason}`);
    }
    return lines.join('\n');
  }

  // Report whichever terminal outcome happened most recently.
  const achieved = manager.getLastAchievedGoal();
  const failed = manager.getLastFailedGoal();
  const achievedAt = achieved?.achievedAt ?? 0;
  const failedAt = failed?.failedAt ?? 0;

  if (failed && failedAt >= achievedAt && failedAt > 0) {
    const elapsed = formatElapsed(failedAt - failed.startedAt);
    const lines = [
      `Last goal abandoned as impossible after ${elapsed} (${failed.turnCount} turn(s), ${failed.tokensSpent} eval tokens):`,
      `  ${failed.condition}`,
    ];
    if (failed.lastReason) {
      lines.push(`Reason: ${failed.lastReason}`);
    }
    return lines.join('\n');
  }

  if (achieved && achieved.achievedAt) {
    const elapsed = formatElapsed(achieved.achievedAt - achieved.startedAt);
    return [
      `Last goal achieved in ${elapsed} (${achieved.turnCount} turn(s), ${achieved.tokensSpent} eval tokens):`,
      `  ${achieved.condition}`,
    ].join('\n');
  }

  return 'No active goal. Set one with `/goal <condition>`.';
}

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  const hours = Math.floor(ms / (60 * 60_000));
  const mins = Math.round((ms - hours * 60 * 60_000) / 60_000);
  return mins ? `${hours}h${mins}m` : `${hours}h`;
}
