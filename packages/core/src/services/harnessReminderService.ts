/**
 * @license
 * Copyright 2025 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 */

import { recordHarnessReminder } from '../telemetry/harnessTelemetry.js';

/**
 * Types of conditions that trigger a harness reminder injection.
 */
export type ReminderTriggerType =
  | 'tool_count_exceeded'
  | 'test_failure_threshold'
  | 'analysis_loop'
  | 'no_progress';

export interface Reminder {
  triggerType: ReminderTriggerType;
  message: string;
  severity: 'warning' | 'hard_stop';
}

export interface ReminderContext {
  toolCallCount: number;
  consecutiveFailures: number;
  turnsWithoutCodeWrite: number;
}

// Thresholds
const TOOL_COUNT_WARN_THRESHOLD = 50;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const ANALYSIS_ONLY_THRESHOLD = 8;

/**
 * Centralized harness reminder service.
 *
 * Call `check()` at the end of each round with the current session context.
 * If any threshold is crossed, it returns reminders to inject as user-role
 * messages. Each reminder is telemetered for Langfuse fine-tuning capture.
 *
 * Injection is the caller's responsibility:
 *   const reminders = harnessReminderService.check(ctx);
 *   for (const r of reminders) {
 *     currentMessages = [...currentMessages, { role: 'user', parts: [{ text: r.message }] }];
 *   }
 */
export class HarnessReminderService {
  private firedAt = new Map<ReminderTriggerType, number>();

  /**
   * Check the current context for reminder conditions.
   * Returns an array of reminders to inject (empty if none needed).
   *
   * Each trigger fires at most once per threshold crossing to prevent
   * spamming the context.
   */
  check(ctx: ReminderContext): Reminder[] {
    const reminders: Reminder[] = [];

    // Tool count exceeded — agent has made many tool calls, prompt to assess
    if (
      ctx.toolCallCount > 0 &&
      ctx.toolCallCount % TOOL_COUNT_WARN_THRESHOLD === 0 &&
      this.firedAt.get('tool_count_exceeded') !== ctx.toolCallCount
    ) {
      this.firedAt.set('tool_count_exceeded', ctx.toolCallCount);
      reminders.push({
        triggerType: 'tool_count_exceeded',
        message: `You have made ${ctx.toolCallCount} tool calls. Step back and assess: (1) What has been accomplished? (2) What remains? (3) Is there a simpler path to completion? Do not continue blindly.`,
        severity: 'warning',
      });
    }

    // Consecutive test failures — agent is stuck on the same error
    if (
      ctx.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD &&
      this.firedAt.get('test_failure_threshold') !== ctx.consecutiveFailures
    ) {
      this.firedAt.set('test_failure_threshold', ctx.consecutiveFailures);
      reminders.push({
        triggerType: 'test_failure_threshold',
        message: `Verification has failed ${ctx.consecutiveFailures} times consecutively. Before retrying:\n1. Identify exactly what went wrong with each failed attempt\n2. Explain why it happened\n3. Describe your corrected approach\n\nDo not blindly retry the same approach.`,
        severity: 'warning',
      });
    }

    // Analysis loop — many turns without any file writes
    if (
      ctx.turnsWithoutCodeWrite >= ANALYSIS_ONLY_THRESHOLD &&
      this.firedAt.get('analysis_loop') !== ctx.turnsWithoutCodeWrite
    ) {
      this.firedAt.set('analysis_loop', ctx.turnsWithoutCodeWrite);
      reminders.push({
        triggerType: 'analysis_loop',
        message: `You have spent ${ctx.turnsWithoutCodeWrite} turns reading and analyzing without writing any code. If you have enough context, start implementing. If you are blocked, describe what is blocking you.`,
        severity: 'warning',
      });
    }

    // Record to Langfuse
    for (const r of reminders) {
      recordHarnessReminder({
        triggerType: r.triggerType,
        message: r.message,
        toolCallCount: ctx.toolCallCount,
      });
    }

    return reminders;
  }

  /**
   * Reset all fired-at state (call when starting a new task/session).
   */
  reset(): void {
    this.firedAt.clear();
  }
}
