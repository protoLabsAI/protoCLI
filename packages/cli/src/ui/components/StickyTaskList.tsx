/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { TodoItem } from './TodoDisplay.js';

/** Most pending items to list before collapsing the remainder. */
const MAX_PENDING_DISPLAY = 7;
/** How many completed items to preview before "… +N done". */
const COMPLETED_PREVIEW = 2;

/**
 * Sticky summary of the current task list, pinned directly above the input
 * instead of scrolling away inline with the tool output. Mirrors Claude Code's
 * todo styling: a count header that breaks out in-progress, the active item in
 * a bold/filled style, pending items dimmed, and collapsed counts for the rest:
 *
 * ```
 * 6 tasks (0 done, 1 in progress, 5 open)
 * ■ Phase A — Friend invite over the new wire
 * □ Phase B — Cloud coordinator › blocked by #94
 * □ Phase C — Identity / accounts / friends › blocked by #94
 *  … +1 pending
 * ```
 *
 * Returns null when there are no tasks so the caller can mount it
 * unconditionally.
 */
export const StickyTaskList: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  if (!todos || todos.length === 0) {
    return null;
  }

  const inProgress = todos.filter((t) => t.status === 'in_progress');
  const pending = todos.filter((t) => t.status === 'pending');
  const completed = todos.filter((t) => t.status === 'completed');
  const total = todos.length;

  const pendingShown = pending.slice(0, MAX_PENDING_DISPLAY);
  const pendingHidden = pending.length - pendingShown.length;
  const completedShown = completed.slice(0, COMPLETED_PREVIEW);
  const completedHidden = completed.length - completedShown.length;

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={1}>
      {/* Count header — numbers emphasized, labels dimmed. */}
      <Text color={theme.text.secondary}>
        <Text bold color={theme.text.primary}>
          {total}
        </Text>{' '}
        task{total === 1 ? '' : 's'} (
        <Text bold color={theme.text.primary}>
          {completed.length}
        </Text>{' '}
        done,{' '}
        <Text bold color={theme.text.primary}>
          {inProgress.length}
        </Text>{' '}
        in progress,{' '}
        <Text bold color={theme.text.primary}>
          {pending.length}
        </Text>{' '}
        open)
      </Text>

      {/* Active items first, then pending, then a preview of completed. */}
      {inProgress.map((todo) => (
        <TaskRow key={todo.id} todo={todo} />
      ))}
      {pendingShown.map((todo) => (
        <TaskRow key={todo.id} todo={todo} />
      ))}
      {pendingHidden > 0 && (
        <Text color={theme.ui.comment}> … +{pendingHidden} pending</Text>
      )}

      {completedShown.map((todo) => (
        <TaskRow key={todo.id} todo={todo} />
      ))}
      {completedHidden > 0 && (
        <Text color={theme.ui.comment}> … +{completedHidden} done</Text>
      )}
    </Box>
  );
};

const TaskRow: React.FC<{ todo: TodoItem }> = ({ todo }) => {
  const isCompleted = todo.status === 'completed';
  const isInProgress = todo.status === 'in_progress';

  // Filled marker for the active item (accent), hollow for pending (dim),
  // check for completed (success).
  const glyph = isCompleted ? '✔' : isInProgress ? '■' : '□';
  const glyphColor = isCompleted
    ? theme.status.success
    : isInProgress
      ? theme.status.warning
      : theme.ui.comment;
  const textColor = isCompleted
    ? theme.ui.comment
    : isInProgress
      ? theme.text.primary
      : theme.text.secondary;

  return (
    <Box flexDirection="row">
      <Box marginRight={1}>
        <Text color={glyphColor}>{glyph}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text
          bold={isInProgress}
          color={textColor}
          strikethrough={isCompleted}
          wrap="truncate-end"
        >
          {todo.content}
        </Text>
      </Box>
    </Box>
  );
};
