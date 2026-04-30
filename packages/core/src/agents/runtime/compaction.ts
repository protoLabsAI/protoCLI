/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Context compaction utilities for AgentCore.
 *
 * Summarizes completed tool call/result pairs to stay within token limits.
 * Operates on the Gemini Content[] history (not AgentMessage[]).
 */

import type { Content, Part } from '@google/genai';
import type { TaskStore } from '../../services/task-store.js';

export interface CompactMessagesOptions {
  /** Optional task store for preserving task plan state in compaction summary. */
  taskStore?: TaskStore;
}

/**
 * Query the task store and produce a structured XML summary of current task states.
 * Format: [x] completed, [~] in_progress, [ ] pending, [-] cancelled, [!] blocked
 * Groups subtasks under their parent tasks with indentation.
 * Returns empty string if no tasks exist.
 */
export async function extractTaskPlanSummary(
  taskStore: TaskStore,
): Promise<string> {
  const tasks = taskStore.list();
  if (tasks.length === 0) return '';

  const STATUS_MARKERS: Record<string, string> = {
    completed: '[x]',
    in_progress: '[~]',
    pending: '[ ]',
    cancelled: '[-]',
    blocked: '[!]',
  };

  // Separate root tasks and subtasks
  const rootTasks = tasks.filter((t) => !t.parentTaskId);
  const subtaskMap = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      if (!subtaskMap.has(t.parentTaskId)) subtaskMap.set(t.parentTaskId, []);
      subtaskMap.get(t.parentTaskId)!.push(t);
    }
  }

  const lines: string[] = ['<task-plan>'];

  for (const task of rootTasks) {
    const marker = STATUS_MARKERS[task.status] ?? '[ ]';
    const priority = task.priority ? ` (${task.priority})` : '';
    lines.push(`  ${marker} ${task.title}${priority}`);

    // Indent subtasks under parent
    const children = subtaskMap.get(task.id) ?? [];
    for (const child of children) {
      const childMarker = STATUS_MARKERS[child.status] ?? '[ ]';
      const childPriority = child.priority ? ` (${child.priority})` : '';
      lines.push(`    ${childMarker} ${child.title}${childPriority}`);
    }
  }

  // Handle orphan subtasks (parent not in list)
  const knownParents = new Set(rootTasks.map((t) => t.id));
  for (const task of tasks) {
    if (task.parentTaskId && !knownParents.has(task.parentTaskId)) {
      const marker = STATUS_MARKERS[task.status] ?? '[ ]';
      const priority = task.priority ? ` (${task.priority})` : '';
      lines.push(`  ${marker} ${task.title}${priority} (orphan)`);
    }
  }

  lines.push('</task-plan>');
  return lines.join('\n');
}

/** Rough token estimation: ~4 chars per token */
export function estimateTokens(messages: Content[]): number {
  return messages.reduce((sum, msg) => {
    const text = contentToText(msg);
    return sum + Math.ceil(text.length / 4);
  }, 0);
}

/**
 * Compact the chat history by summarizing completed tool call/result pairs.
 * Preserves recent messages intact. Tool call/result pairs are kept atomic.
 *
 * When `options.taskStore` is provided, also appends a structured task plan
 * summary so the agent retains awareness of completed/in-progress/pending work
 * after compaction.
 *
 * @param history - Full Content[] history from GeminiChat.getHistory()
 * @param targetTokens - Target token count after compaction (usually 70% of max)
 * @param options - Optional config (taskStore for todo preservation)
 * @returns Compacted Content[] array (sync) or Promise<Content[]> if taskStore provided
 */
export function compactMessages(
  history: Content[],
  _targetTokens: number,
  options?: CompactMessagesOptions,
): Content[] | Promise<Content[]> {
  if (history.length === 0) return history;

  // Always keep last N messages verbatim to preserve recent context
  const PRESERVE_RECENT = 10;

  if (history.length <= PRESERVE_RECENT) return history;

  const compactable = history.slice(0, history.length - PRESERVE_RECENT);
  const recent = history.slice(history.length - PRESERVE_RECENT);

  // Build summary of compactable section, keeping tool pairs atomic
  const summary = summarizeHistory(compactable);

  // If taskStore is provided, we need async — return a Promise
  if (options?.taskStore) {
    return (async () => {
      const taskPlan = await extractTaskPlanSummary(options.taskStore!);
      const fullSummary = taskPlan
        ? summary + '\n\nCurrent task plan state:\n' + taskPlan
        : summary;
      const summaryContent: Content = {
        role: 'user',
        parts: [
          {
            text: `[Context compacted — summary of earlier work:\n${fullSummary}]`,
          },
        ],
      };
      return [summaryContent, ...recent];
    })();
  }

  // Sync path — no task store
  const summaryContent: Content = {
    role: 'user',
    parts: [
      {
        text: `[Context compacted — summary of earlier work:\n${summary}]`,
      },
    ],
  };

  return [summaryContent, ...recent];
}

/**
 * Summarize a list of Content messages into a compact text representation.
 * Tool call/result pairs are processed atomically.
 */
function summarizeHistory(messages: Content[]): string {
  const lines: string[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'model' && hasToolCall(msg)) {
      // Collect all tool calls in this model turn
      const toolNames = extractToolNames(msg);
      // Look ahead for the corresponding tool result (user turn with functionResponse)
      const next = messages[i + 1];
      if (next && next.role === 'user' && hasToolResult(next)) {
        const resultSummary = truncate(extractToolResults(next), 200);
        lines.push(`- Called ${toolNames.join(', ')}: ${resultSummary}`);
        i += 2; // skip both call and result
      } else {
        lines.push(`- Called ${toolNames.join(', ')} (no result recorded)`);
        i++;
      }
    } else {
      const text = truncate(contentToText(msg), 300);
      if (text) lines.push(`[${msg.role}]: ${text}`);
      i++;
    }
  }

  return lines.join('\n');
}

function hasToolCall(msg: Content): boolean {
  return (msg.parts ?? []).some((p: Part) => p.functionCall != null);
}

function hasToolResult(msg: Content): boolean {
  return (msg.parts ?? []).some((p: Part) => p.functionResponse != null);
}

function extractToolNames(msg: Content): string[] {
  return (msg.parts ?? [])
    .filter((p: Part) => p.functionCall != null)
    .map((p: Part) => p.functionCall?.name ?? 'unknown_tool');
}

function extractToolResults(msg: Content): string {
  return (msg.parts ?? [])
    .filter((p: Part) => p.functionResponse != null)
    .map((p: Part) => {
      const resp = p.functionResponse?.response;
      if (resp == null) return '(empty)';
      if (typeof resp === 'string') return resp;
      return JSON.stringify(resp);
    })
    .join('; ');
}

function contentToText(msg: Content): string {
  return (msg.parts ?? [])
    .map((p: Part) => {
      if (p.text) return p.text;
      if (p.functionCall)
        return `[tool_call: ${p.functionCall.name}(${JSON.stringify(p.functionCall.args ?? {})})]`;
      if (p.functionResponse)
        return `[tool_result: ${p.functionResponse.name} = ${JSON.stringify(p.functionResponse.response ?? {})}]`;
      return '';
    })
    .join(' ');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '\u2026';
}
