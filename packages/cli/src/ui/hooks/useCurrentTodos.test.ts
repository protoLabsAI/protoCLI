/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { extractCurrentTodos } from './useCurrentTodos.js';
import type { HistoryItem } from '../types.js';

function toolGroup(id: number, resultDisplay: unknown): HistoryItem {
  return {
    id,
    type: 'tool_group',
    tools: [
      {
        callId: `call-${id}`,
        name: 'task_list',
        description: '',
        resultDisplay: resultDisplay as never,
        status: 'Success' as never,
        confirmationDetails: undefined,
      },
    ],
  } as HistoryItem;
}

const todoList = (
  todos: Array<{ id: string; content: string; status: string }>,
) => ({
  type: 'todo_list',
  todos,
});

describe('extractCurrentTodos', () => {
  it('returns an empty array when history has no todo_list result', () => {
    const history: HistoryItem[] = [
      { id: 1, type: 'user', text: 'hi' } as HistoryItem,
      toolGroup(2, 'plain string output'),
    ];
    expect(extractCurrentTodos(history)).toEqual([]);
  });

  it('returns the todos from the only todo_list result', () => {
    const history: HistoryItem[] = [
      toolGroup(
        1,
        todoList([{ id: 'a', content: 'task a', status: 'pending' }]),
      ),
    ];
    expect(extractCurrentTodos(history)).toEqual([
      { id: 'a', content: 'task a', status: 'pending' },
    ]);
  });

  it('returns the MOST RECENT todo_list when several exist', () => {
    const history: HistoryItem[] = [
      toolGroup(1, todoList([{ id: 'a', content: 'old', status: 'pending' }])),
      toolGroup(
        2,
        todoList([{ id: 'a', content: 'old', status: 'completed' }]),
      ),
    ];
    expect(extractCurrentTodos(history)).toEqual([
      { id: 'a', content: 'old', status: 'completed' },
    ]);
  });

  it('ignores non-todo_list result displays while scanning back', () => {
    const history: HistoryItem[] = [
      toolGroup(
        1,
        todoList([{ id: 'a', content: 'task a', status: 'pending' }]),
      ),
      toolGroup(2, { type: 'task_update_diff' }),
      toolGroup(3, 'string result'),
    ];
    expect(extractCurrentTodos(history)).toEqual([
      { id: 'a', content: 'task a', status: 'pending' },
    ]);
  });
});
