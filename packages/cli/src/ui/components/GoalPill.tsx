/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { GoalStatusSnapshot } from '../hooks/useGoalStatus.js';

/** Visual cap so the condition doesn't push other footer items off-screen. */
const MAX_CONDITION_DISPLAY = 30;

/**
 * Footer indicator for an active `/goal`. Mirrors the Codex CLI status-bar
 * treatment: shows the active condition (truncated) and the turn count so
 * the user can see at a glance that the goal loop is running and how far in
 * it is. Hidden entirely when no goal is active -- callers should check
 * `snapshot != null` before rendering this component.
 */
export const GoalPill: React.FC<{ snapshot: GoalStatusSnapshot }> = ({
  snapshot,
}) => {
  const label = truncate(snapshot.condition, MAX_CONDITION_DISPLAY);
  return (
    <Text color={theme.status.warning}>
      ◎ {label} · T{snapshot.turnCount}
    </Text>
  );
};

/**
 * Truncate `s` to at most `max` characters, using a single ellipsis. Splits
 * the budget so the ellipsis is part of the budget (not appended).
 */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return '…'.slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}
