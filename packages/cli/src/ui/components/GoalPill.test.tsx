/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { GoalPill, truncate } from './GoalPill.js';

describe('GoalPill', () => {
  it('renders the condition + turn count for a short condition', () => {
    const { lastFrame } = render(
      <GoalPill
        snapshot={{
          condition: 'all tests pass',
          turnCount: 0,
          startedAt: Date.now(),
        }}
      />,
    );
    expect(lastFrame()).toContain('◎ all tests pass · T0');
  });

  it('shows non-zero turn counts', () => {
    const { lastFrame } = render(
      <GoalPill
        snapshot={{
          condition: 'cleanup queue',
          turnCount: 7,
          startedAt: Date.now(),
        }}
      />,
    );
    expect(lastFrame()).toContain('· T7');
  });

  it('truncates long conditions with an ellipsis', () => {
    const long =
      'migrate every call site in apps/server/src/providers to the new SDK shape';
    const { lastFrame } = render(
      <GoalPill
        snapshot={{ condition: long, turnCount: 2, startedAt: Date.now() }}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('…');
    expect(frame).toContain('· T2');
    expect(frame).not.toContain(long);
  });
});

describe('truncate', () => {
  it('returns the input unchanged when shorter than max', () => {
    expect(truncate('short', 30)).toBe('short');
  });

  it('returns the input unchanged when exactly at max', () => {
    expect(truncate('x'.repeat(30), 30)).toBe('x'.repeat(30));
  });

  it('uses a single trailing ellipsis when over the limit', () => {
    expect(truncate('x'.repeat(31), 30)).toBe('x'.repeat(29) + '…');
  });

  it('handles a tiny max gracefully', () => {
    expect(truncate('hello', 1)).toBe('…');
    expect(truncate('hello', 0)).toBe('');
  });
});
