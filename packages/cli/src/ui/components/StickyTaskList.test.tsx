/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StickyTaskList } from './StickyTaskList.js';
import type { TodoItem } from './TodoDisplay.js';

function todo(
  id: string,
  content: string,
  status: TodoItem['status'],
): TodoItem {
  return { id, content, status };
}

describe('StickyTaskList', () => {
  it('renders nothing when there are no todos', () => {
    const { lastFrame } = render(<StickyTaskList todos={[]} />);
    expect(lastFrame()).toBe('');
  });

  it('renders a count header with done/open totals', () => {
    const todos: TodoItem[] = [
      todo('1', 'do a thing', 'pending'),
      todo('2', 'in flight', 'in_progress'),
      todo('3', 'finished', 'completed'),
    ];
    const { lastFrame } = render(<StickyTaskList todos={todos} />);
    expect(lastFrame()).toContain('3 tasks (1 done, 2 open)');
  });

  it('uses the singular noun for a single task', () => {
    const { lastFrame } = render(
      <StickyTaskList todos={[todo('1', 'only one', 'pending')]} />,
    );
    expect(lastFrame()).toContain('1 task (0 done, 1 open)');
  });

  it('lists open items with the open glyph and previews completed items', () => {
    const todos: TodoItem[] = [
      todo('1', 'open alpha', 'pending'),
      todo('2', 'open beta', 'in_progress'),
      todo('3', 'done gamma', 'completed'),
    ];
    const frame = render(<StickyTaskList todos={todos} />).lastFrame() ?? '';
    expect(frame).toContain('◻');
    expect(frame).toContain('open alpha');
    expect(frame).toContain('open beta');
    expect(frame).toContain('✔');
    expect(frame).toContain('done gamma');
  });

  it('collapses extra completed items into a "+N completed" line', () => {
    const todos: TodoItem[] = [
      todo('o1', 'open one', 'pending'),
      ...Array.from({ length: 16 }, (_, i) =>
        todo(`c${i}`, `completed ${i}`, 'completed' as const),
      ),
    ];
    const frame = render(<StickyTaskList todos={todos} />).lastFrame() ?? '';
    // 17 total: 1 open, 16 done. Two completed previewed, 14 collapsed.
    expect(frame).toContain('17 tasks (16 done, 1 open)');
    expect(frame).toContain('… +14 completed');
  });

  it('collapses extra open items into a "+N more open" line', () => {
    const todos: TodoItem[] = Array.from({ length: 10 }, (_, i) =>
      todo(`o${i}`, `open ${i}`, 'pending' as const),
    );
    const frame = render(<StickyTaskList todos={todos} />).lastFrame() ?? '';
    // 10 open, cap is 7 -> 3 collapsed.
    expect(frame).toContain('… +3 more open');
  });
});
