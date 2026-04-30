/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  compactMessages,
  extractTaskPlanSummary,
} from './compaction.js';
import type { Content } from '@google/genai';
import type { Task, TaskStore } from '../../services/task-store.js';

describe('estimateTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateTokens([])).toBe(0);
  });

  it('estimates based on character length', () => {
    const msgs: Content[] = [
      { role: 'user', parts: [{ text: 'hello world' }] },
    ];
    expect(estimateTokens(msgs)).toBeGreaterThan(0);
  });

  it('sums across multiple messages', () => {
    const single: Content[] = [
      { role: 'user', parts: [{ text: 'hello world' }] },
    ];
    const double: Content[] = [
      { role: 'user', parts: [{ text: 'hello world' }] },
      { role: 'model', parts: [{ text: 'hello world' }] },
    ];
    expect(estimateTokens(double)).toBe(estimateTokens(single) * 2);
  });
});

describe('compactMessages', () => {
  it('returns unchanged if few messages', () => {
    const msgs: Content[] = [
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
    ];
    const result = compactMessages(msgs, 1000) as Content[];
    expect(result).toHaveLength(2);
  });

  it('compacts when many messages', () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `message ${i} with some content to count` }],
    }));
    const compacted = compactMessages(msgs, 100) as Content[];
    expect(compacted.length).toBeLessThan(msgs.length);
  });

  it('preserves recent messages verbatim', () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `message ${i}` }],
    }));
    const compacted = compactMessages(msgs, 100) as Content[];
    // Last 10 messages should be preserved unchanged
    const originalLast10 = msgs.slice(msgs.length - 10);
    const compactedLast10 = compacted.slice(compacted.length - 10);
    expect(compactedLast10).toEqual(originalLast10);
  });

  it('includes a summary content entry', () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `message ${i}` }],
    }));
    const compacted = compactMessages(msgs, 100) as Content[];
    // First message should be the summary
    const firstPart = compacted[0]?.parts?.[0]?.text ?? '';
    expect(firstPart).toContain('Context compacted');
  });

  it('never splits tool call/result pairs', () => {
    // Build: 5 tool call+result pairs, then 10 recent messages
    const toolPairs: Content[] = Array.from({ length: 5 }, (_, i) => [
      {
        role: 'model',
        parts: [{ functionCall: { name: `tool${i}`, args: {} } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: `tool${i}`,
              response: { result: `result${i}` },
            },
          },
        ],
      },
    ]).flat() as Content[];

    const recent: Content[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `recent ${i}` }],
    }));

    const msgs: Content[] = [...toolPairs, ...recent];
    const compacted = compactMessages(msgs, 100) as Content[];
    // Should reduce length and not crash
    expect(compacted.length).toBeLessThan(msgs.length);
    // The summary should mention the tool calls
    const summaryText = compacted[0]?.parts?.[0]?.text ?? '';
    expect(summaryText).toContain('tool0');
  });

  it('handles messages with no parts gracefully', () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: i === 0 ? [] : [{ text: `msg ${i}` }],
    }));
    expect(() => compactMessages(msgs, 100)).not.toThrow();
  });
});

function mockTaskStore(tasks: Array<Partial<Task>>): TaskStore {
  return {
    list: () =>
      tasks.map((t, i) => ({
        id: `task-${i}`,
        title: t.title ?? `Task ${i}`,
        status: t.status ?? 'pending',
        priority: t.priority ?? 'medium',
        parentTaskId: t.parentTaskId,
        description: t.description,
        createdBy: 'agent',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
  } as unknown as TaskStore;
}

describe('extractTaskPlanSummary', () => {
  it('produces empty string when no tasks exist', async () => {
    const store = mockTaskStore([]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toBe('');
  });

  it('produces structured XML summary with task states', async () => {
    const store = mockTaskStore([
      {
        title: 'Research existing metrics',
        status: 'completed',
        priority: 'high',
      },
      {
        title: 'Design metrics collection',
        status: 'completed',
        priority: 'high',
      },
      {
        title: 'Implement core tracking',
        status: 'in_progress',
        priority: 'high',
      },
      {
        title: 'Create export functionality',
        status: 'pending',
        priority: 'medium',
      },
    ]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toContain('<task-plan>');
    expect(result).toContain('Research existing metrics');
    expect(result).toContain('[x]'); // completed marker
    expect(result).toContain('[~]'); // in_progress marker
    expect(result).toContain('[ ]'); // pending marker
  });

  it('includes priority labels', async () => {
    const store = mockTaskStore([
      { title: 'Critical task', status: 'pending', priority: 'critical' },
      { title: 'Low priority', status: 'pending', priority: 'low' },
    ]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toContain('(critical)');
    expect(result).toContain('(low)');
  });

  it('groups subtasks under parent tasks', async () => {
    const store = mockTaskStore([
      {
        id: 'task-0',
        title: 'Parent feature',
        status: 'in_progress',
        priority: 'high',
      },
      {
        id: 'task-1',
        title: 'Subtask A',
        status: 'completed',
        priority: 'medium',
        parentTaskId: 'task-0',
      },
      {
        id: 'task-2',
        title: 'Subtask B',
        status: 'pending',
        priority: 'medium',
        parentTaskId: 'task-0',
      },
    ]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toContain('Parent feature');
    expect(result).toContain('Subtask A');
    expect(result).toContain('Subtask B');
  });

  it('handles cancelled and blocked statuses', async () => {
    const store = mockTaskStore([
      { title: 'Cancelled work', status: 'cancelled' },
      { title: 'Blocked work', status: 'blocked' },
    ]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toContain('[-]'); // cancelled marker
    expect(result).toContain('[!]'); // blocked marker
  });

  it('recursively renders multi-level nesting', async () => {
    const store = mockTaskStore([
      { id: 'task-0', title: 'Root', status: 'in_progress' },
      {
        id: 'task-1',
        title: 'Level 1',
        status: 'pending',
        parentTaskId: 'task-0',
      },
      {
        id: 'task-2',
        title: 'Level 2',
        status: 'pending',
        parentTaskId: 'task-1',
      },
      {
        id: 'task-3',
        title: 'Level 3',
        status: 'pending',
        parentTaskId: 'task-2',
      },
    ]);
    const result = await extractTaskPlanSummary(store);
    expect(result).toContain('Root');
    expect(result).toContain('Level 1');
    expect(result).toContain('Level 2');
    expect(result).toContain('Level 3');
    // Verify indentation increases with depth
    const rootIdx = result.indexOf('Root');
    const l1Idx = result.indexOf('Level 1');
    const l2Idx = result.indexOf('Level 2');
    const l3Idx = result.indexOf('Level 3');
    expect(l1Idx).toBeGreaterThan(rootIdx);
    expect(l2Idx).toBeGreaterThan(l1Idx);
    expect(l3Idx).toBeGreaterThan(l2Idx);
  });
});

describe('compactMessages with task plan', () => {
  it('appends task plan section to compaction summary', async () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [
        {
          text: `message ${i} with enough content to trigger compaction logic`,
        },
      ],
    }));
    const store = mockTaskStore([
      { title: 'Done work', status: 'completed' },
      { title: 'Current work', status: 'in_progress' },
      { title: 'Future work', status: 'pending' },
    ]);
    const result = await compactMessages(msgs, 100, { taskStore: store });
    const summaryText = result[0]?.parts?.[0]?.text ?? '';
    expect(summaryText).toContain('Context compacted');
    expect(summaryText).toContain('<task-plan>');
    expect(summaryText).toContain('[x] Done work');
    expect(summaryText).toContain('[~] Current work');
    expect(summaryText).toContain('[ ] Future work');
  });

  it('omits task plan when taskStore not provided', () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [
        {
          text: `message ${i} with enough content to trigger compaction logic`,
        },
      ],
    }));
    const result = compactMessages(msgs, 100);
    // Sync return — not a Promise
    expect(result).not.toBeInstanceOf(Promise);
    const summaryText = (result as Content[])[0]?.parts?.[0]?.text ?? '';
    expect(summaryText).not.toContain('<task-plan>');
  });

  it('returns unchanged when few messages even with taskStore', async () => {
    const msgs: Content[] = [
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
    ];
    const store = mockTaskStore([{ title: 'Some task', status: 'pending' }]);
    const result = await compactMessages(msgs, 1000, { taskStore: store });
    expect(result).toHaveLength(2);
  });

  it('gracefully handles taskStore errors and falls back to plain summary', async () => {
    const msgs: Content[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [
        {
          text: `message ${i} with enough content to trigger compaction logic`,
        },
      ],
    }));
    const failingStore = {
      list: () => {
        throw new Error('store is broken');
      },
    } as unknown as TaskStore;
    const result = await compactMessages(msgs, 100, {
      taskStore: failingStore,
    });
    // Should not throw — falls back to plain summary
    const summaryText = result[0]?.parts?.[0]?.text ?? '';
    expect(summaryText).toContain('Context compacted');
    expect(summaryText).not.toContain('<task-plan>');
  });
});
