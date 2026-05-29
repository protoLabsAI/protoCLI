/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import type { ToolCallRecord } from '../hooks/completion-checker.js';
import {
  summarizeToolCallsForGoal,
  MAX_ACTION_LINES,
  MAX_READ_LINES,
} from './toolCallSummary.js';

const call = (
  name: string,
  input?: Record<string, unknown>,
  success = true,
): ToolCallRecord => ({ name, success, input });

describe('summarizeToolCallsForGoal', () => {
  it('returns an empty string for no records', () => {
    expect(summarizeToolCallsForGoal([])).toBe('');
  });

  it('separates state-changing actions from read-only inspections', () => {
    const summary = summarizeToolCallsForGoal([
      call('write_file', { file_path: 'a.md' }),
      call('read_file', { file_path: 'a.md' }),
    ]);
    expect(summary).toContain('Actions taken');
    expect(summary).toContain('- write_file a.md [ok]');
    expect(summary).toContain('Inspections / reads');
    expect(summary).toContain('- read_file a.md [ok]');
  });

  it('collapses repeated identical calls into a count', () => {
    const summary = summarizeToolCallsForGoal([
      call('read_file', { file_path: 'a.md' }),
      call('read_file', { file_path: 'a.md' }),
      call('read_file', { file_path: 'a.md' }),
    ]);
    expect(summary).toContain('- read_file a.md [ok] (x3)');
  });

  it('keeps distinct targets on separate lines', () => {
    const summary = summarizeToolCallsForGoal([
      call('write_file', { file_path: 'a.md' }),
      call('write_file', { file_path: 'b.md' }),
    ]);
    expect(summary).toContain('- write_file a.md [ok]');
    expect(summary).toContain('- write_file b.md [ok]');
  });

  it('preserves early writes even when later reads flood the window', () => {
    // The regression this module exists for: an agent that finishes the work
    // (one write) then re-reads many distinct files on continuation turns.
    const records: ToolCallRecord[] = [
      call('write_file', { file_path: 'deliverable.md' }),
    ];
    for (let i = 0; i < 100; i++) {
      records.push(call('read_file', { file_path: `other-${i}.md` }));
    }
    const summary = summarizeToolCallsForGoal(records);
    // The write survives despite 100 later reads...
    expect(summary).toContain('- write_file deliverable.md [ok]');
    // ...while the read flood is capped.
    const readLines = summary
      .split('\n')
      .filter((l) => l.startsWith('- read_file'));
    expect(readLines.length).toBe(MAX_READ_LINES);
    expect(summary).toMatch(/Inspections \/ reads.*earlier omitted:/);
  });

  it('caps actions and notes how many were omitted', () => {
    const records: ToolCallRecord[] = [];
    for (let i = 0; i < MAX_ACTION_LINES + 5; i++) {
      records.push(call('write_file', { file_path: `f-${i}.md` }));
    }
    const summary = summarizeToolCallsForGoal(records);
    const actionLines = summary
      .split('\n')
      .filter((l) => l.startsWith('- write_file'));
    expect(actionLines.length).toBe(MAX_ACTION_LINES);
    expect(summary).toContain('5 earlier omitted:');
    // The most recent action is kept; the oldest is dropped.
    expect(summary).toContain(`- write_file f-${MAX_ACTION_LINES + 4}.md`);
    expect(summary).not.toContain('- write_file f-0.md ');
  });

  it('normalizes legacy tool names so aliases dedupe and classify together', () => {
    const summary = summarizeToolCallsForGoal([
      call('replace', { file_path: 'a.ts' }), // legacy -> edit (action)
      call('search_file_content', { pattern: 'TODO' }), // legacy -> grep (read)
      call('search_file_content', { pattern: 'TODO' }),
    ]);
    expect(summary).toContain('- edit a.ts [ok]');
    expect(summary).toContain('Inspections / reads');
    expect(summary).toContain('- grep_search TODO [ok] (x2)');
  });

  it('reports mixed and full failure states', () => {
    const summary = summarizeToolCallsForGoal([
      call('run_shell_command', { command: 'npm test' }, false),
      call('run_shell_command', { command: 'npm test' }, true),
      call('run_shell_command', { command: 'npm run lint' }, false),
    ]);
    expect(summary).toContain('- run_shell_command npm test [1 ok, 1 failed]');
    expect(summary).toContain('- run_shell_command npm run lint [failed]');
  });

  it('treats unknown / MCP tools as actions so they are preserved', () => {
    const summary = summarizeToolCallsForGoal([
      call('mcp__plugin_foo__do_thing', { title: 'ship it' }),
    ]);
    expect(summary).toContain('Actions taken');
    expect(summary).toContain('- mcp__plugin_foo__do_thing ship it [ok]');
    expect(summary).not.toContain('Inspections');
  });

  it('collapses whitespace and truncates long targets', () => {
    const longCmd = 'echo ' + 'x'.repeat(300);
    const summary = summarizeToolCallsForGoal([
      call('run_shell_command', { command: `  ${longCmd}  ` }),
    ]);
    expect(summary).toContain('...'); // truncation marker
    expect(summary).not.toContain('  echo'); // leading whitespace collapsed
    const line = summary.split('\n').find((l) => l.startsWith('- '));
    expect(line!.length).toBeLessThan(160);
  });

  it('omits a section entirely when it has no entries', () => {
    const onlyReads = summarizeToolCallsForGoal([
      call('read_file', { file_path: 'a.md' }),
    ]);
    expect(onlyReads).not.toContain('Actions taken');
    expect(onlyReads).toContain('Inspections / reads');
  });
});
