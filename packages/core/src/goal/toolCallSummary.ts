/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolCallRecord } from '../hooks/completion-checker.js';
import { ToolNames, ToolNamesMigration } from '../tools/tool-names.js';

/**
 * Maximum number of distinct state-changing actions to surface. Actions are
 * the durable evidence a goal was met (a file was written, an edit applied, a
 * command run), so this cap is generous -- we'd rather keep an early write than
 * a late read.
 */
export const MAX_ACTION_LINES = 30;

/**
 * Maximum number of distinct read-only inspections to surface. Reads are
 * context, not evidence of work, so a tighter cap is fine: the most recent few
 * are enough to show what the agent was looking at.
 */
export const MAX_READ_LINES = 12;

/** Max characters of a call's target (file path, command, pattern, ...). */
const MAX_TARGET_LEN = 120;

/**
 * Tools that only read state. Built from the canonical {@link ToolNames} so the
 * set stays in sync with the registry; anything NOT listed here (writes, shell,
 * MCP tools, unknown names) is treated as a state-changing action and preserved
 * preferentially. Legacy aliases are normalized via {@link ToolNamesMigration}
 * before lookup, so only names without a migration entry are listed literally.
 */
const READ_ONLY_TOOLS = new Set<string>([
  ToolNames.READ_FILE,
  ToolNames.GREP,
  ToolNames.GLOB,
  ToolNames.LS,
  ToolNames.WEB_FETCH,
  ToolNames.WEB_SEARCH,
  ToolNames.LSP,
  ToolNames.REPO_MAP,
  ToolNames.TASK_GET,
  ToolNames.TASK_LIST,
  ToolNames.TASK_OUTPUT,
  ToolNames.TASK_READY,
  // Real read-only tools without a ToolNames entry:
  'read_many_files',
]);

/**
 * Input keys to probe, in priority order, for a human-meaningful target to
 * show alongside a tool call. The first present string wins.
 */
const TARGET_KEYS = [
  'file_path',
  'absolute_path',
  'notebook_path',
  'path',
  'command',
  'pattern',
  'url',
  'query',
  'prompt',
  'description',
  'skill',
  'fact',
  'title',
  'task_id',
] as const;

interface AggregatedCall {
  name: string;
  target: string;
  readOnly: boolean;
  count: number;
  okCount: number;
  failCount: number;
  /** Index of this call's most recent occurrence, for recency ordering. */
  lastIndex: number;
}

/**
 * Build a compact, deduplicated summary of tool activity for the goal
 * evaluator. The naive "last N raw calls" window let read-only churn on
 * re-confirmation turns (repeated reads/lists) push the original writes out of
 * view, so the judge could never see the evidence that satisfied the goal. This
 * collapses repeats into counts and retains every distinct action while capping
 * read noise, so the deliverable stays visible no matter how long the agent
 * loops afterward.
 *
 * Returns an empty string when there are no tool calls; the caller substitutes
 * its own "(none)" placeholder.
 */
export function summarizeToolCallsForGoal(records: ToolCallRecord[]): string {
  if (records.length === 0) return '';

  const byKey = new Map<string, AggregatedCall>();
  records.forEach((record, index) => {
    const name = canonicalName(record.name);
    const target = extractTarget(record.input);
    const key = `${name} ${target}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastIndex = index;
      if (record.success) existing.okCount += 1;
      else existing.failCount += 1;
    } else {
      byKey.set(key, {
        name,
        target,
        readOnly: READ_ONLY_TOOLS.has(name),
        count: 1,
        okCount: record.success ? 1 : 0,
        failCount: record.success ? 0 : 1,
        lastIndex: index,
      });
    }
  });

  const distinct = [...byKey.values()].sort(
    (a, b) => a.lastIndex - b.lastIndex,
  );
  const actions = distinct.filter((c) => !c.readOnly);
  const reads = distinct.filter((c) => c.readOnly);

  const sections: string[] = [];
  const actionSection = renderSection(
    'Actions taken (most recent last)',
    actions,
    MAX_ACTION_LINES,
  );
  if (actionSection) sections.push(actionSection);
  const readSection = renderSection(
    'Inspections / reads (most recent last)',
    reads,
    MAX_READ_LINES,
  );
  if (readSection) sections.push(readSection);

  return sections.join('\n');
}

/** Map legacy tool names to their canonical form so aliases dedupe together. */
function canonicalName(name: string): string {
  const migrated = (ToolNamesMigration as Record<string, string>)[name];
  return migrated ?? name;
}

/** Pull the first meaningful target value from a tool call's input args. */
function extractTarget(input: Record<string, unknown> | undefined): string {
  if (!input) return '';
  for (const key of TARGET_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return truncateTarget(value);
    }
  }
  return '';
}

function truncateTarget(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length <= MAX_TARGET_LEN
    ? collapsed
    : `${collapsed.slice(0, MAX_TARGET_LEN - 3)}...`;
}

/**
 * Render one labelled section, keeping the most recent `limit` entries and
 * noting how many earlier ones were dropped. Returns '' for an empty group.
 */
function renderSection(
  label: string,
  entries: AggregatedCall[],
  limit: number,
): string {
  if (entries.length === 0) return '';
  const kept = entries.length > limit ? entries.slice(-limit) : entries;
  const omitted = entries.length - kept.length;
  const header =
    omitted > 0 ? `${label}; ${omitted} earlier omitted:` : `${label}:`;
  const lines = kept.map((c) => `- ${renderLine(c)}`);
  return [header, ...lines].join('\n');
}

function renderLine(call: AggregatedCall): string {
  const target = call.target ? ` ${call.target}` : '';
  const status = renderStatus(call);
  const repeat = call.count > 1 ? ` (x${call.count})` : '';
  return `${call.name}${target} ${status}${repeat}`;
}

function renderStatus(call: AggregatedCall): string {
  if (call.failCount === 0) return '[ok]';
  if (call.okCount === 0) return '[failed]';
  return `[${call.okCount} ok, ${call.failCount} failed]`;
}
