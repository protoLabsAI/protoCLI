/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { HistoryItem } from '../types.js';
import type { TodoItem } from '../components/TodoDisplay.js';

/**
 * Scan history backwards for the most recent `todo_list` tool result and
 * return its todos. The task tools (TaskCreate/TaskList/TaskUpdate/TaskStop)
 * each emit a fresh snapshot of the full list, so the newest one is the
 * current state.
 *
 * Deriving from history avoids polling `config.getTaskStore().list()`, which
 * shells out to `br` via blocking `execFileSync` in interactive sessions --
 * doing that on an interval would stutter the TUI. History updates exactly
 * when the list changes, for free.
 *
 * Returns an empty array when no task list has been produced this session.
 */
export function extractCurrentTodos(history: HistoryItem[]): TodoItem[] {
  if (!history) return [];
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.type !== 'tool_group') continue;
    for (let j = item.tools.length - 1; j >= 0; j--) {
      const rd = item.tools[j].resultDisplay;
      if (
        rd &&
        typeof rd === 'object' &&
        'type' in rd &&
        (rd as { type?: string }).type === 'todo_list'
      ) {
        return (rd as { todos?: TodoItem[] }).todos ?? [];
      }
    }
  }
  return [];
}

/** Memoized hook wrapper around {@link extractCurrentTodos}. */
export function useCurrentTodos(history: HistoryItem[]): TodoItem[] {
  return useMemo(() => extractCurrentTodos(history), [history]);
}
