/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { TodoItem } from './TodoDisplay.js';

/** Most open items to list before collapsing the remainder. */
const MAX_OPEN_DISPLAY = 7;
/** How many completed items to preview before "… +N completed". */
const COMPLETED_PREVIEW = 2;

/**
 * Sticky summary of the current task list, pinned directly above the input
 * instead of scrolling away inline with the tool output. Shows a count header
 * (`19 tasks (16 done, 3 open)`), the open/in-progress items, a short preview
 * of completed items, and a collapsed count for the rest:
 *
 * ```
 * 19 tasks (16 done, 3 open)
 * ◻ Wire Temporal healthcheck + Postiz depends_on: service_healthy
 * ◻ Manual cleanup of orphaned mlflow data dir
 * ✔ Deploy studio stack + restart cloudflared
 *    … +14 completed
 * ```
 *
 * Returns null when there are no tasks so the caller can mount it
 * unconditionally.
 */
export const StickyTaskList: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  if (!todos || todos.length === 0) {
    return null;
  }

  const open = todos.filter((t) => t.status !== 'completed');
  const completed = todos.filter((t) => t.status === 'completed');
  const total = todos.length;

  const openShown = open.slice(0, MAX_OPEN_DISPLAY);
  const openHidden = open.length - openShown.length;
  const completedShown = completed.slice(0, COMPLETED_PREVIEW);
  const completedHidden = completed.length - completedShown.length;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.text.secondary}>
        {total} task{total === 1 ? '' : 's'} ({completed.length} done,{' '}
        {open.length} open)
      </Text>

      {openShown.map((todo) => (
        <TaskRow key={todo.id} todo={todo} />
      ))}
      {openHidden > 0 && (
        <Text color={theme.ui.comment}> … +{openHidden} more open</Text>
      )}

      {completedShown.map((todo) => (
        <TaskRow key={todo.id} todo={todo} />
      ))}
      {completedHidden > 0 && (
        <Text color={theme.ui.comment}> … +{completedHidden} completed</Text>
      )}
    </Box>
  );
};

const TaskRow: React.FC<{ todo: TodoItem }> = ({ todo }) => {
  const isCompleted = todo.status === 'completed';
  const isInProgress = todo.status === 'in_progress';

  return (
    <Box flexDirection="row">
      <Box width={2}>
        <Text color={isCompleted ? theme.status.success : theme.ui.comment}>
          {isCompleted ? '✔' : '◻'}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text
          color={
            isCompleted
              ? theme.ui.comment
              : isInProgress
                ? theme.status.success
                : theme.text.primary
          }
          strikethrough={isCompleted}
          wrap="truncate-end"
        >
          {todo.content}
        </Text>
      </Box>
    </Box>
  );
};
