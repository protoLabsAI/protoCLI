/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { goalCommand, statusText } from './goalCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { GoalManager } from '@qwen-code/qwen-code-core';

function makeContext(manager: GoalManager): CommandContext {
  return createMockCommandContext({
    services: {
      config: {
        getGoalManager: () => manager,
      },
    },
  } as unknown as CommandContext);
}

describe('goalCommand', () => {
  let manager: GoalManager;
  let ctx: CommandContext;

  beforeEach(() => {
    manager = new GoalManager();
    ctx = makeContext(manager);
  });

  it('errors when config is not available', async () => {
    const noConfigCtx = createMockCommandContext({
      services: { config: null },
    } as unknown as CommandContext);
    const result = await goalCommand.action!(noConfigCtx, 'all tests pass');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: expect.stringMatching(/config/i),
    });
  });

  describe('status mode (no args)', () => {
    it('reports no active goal when none is set', async () => {
      const result = await goalCommand.action!(ctx, '');
      expect(result).toMatchObject({
        type: 'message',
        messageType: 'info',
      });
      const content = (result as { content: string }).content;
      expect(content).toMatch(/no active goal/i);
    });

    it('reports the active goal', async () => {
      manager.setGoal('all tests pass');
      manager.recordTurn();
      manager.recordEvaluation({
        met: false,
        reason: 'tests still failing',
        tokensUsed: 42,
      });
      const result = await goalCommand.action!(ctx, '');
      const content = (result as { content: string }).content;
      expect(content).toMatch(/active goal/i);
      expect(content).toMatch(/all tests pass/);
      expect(content).toMatch(/tests still failing/);
    });

    it('reports the last achieved goal if no active goal', async () => {
      manager.setGoal('cleanup');
      manager.markAchieved();
      const result = await goalCommand.action!(ctx, '');
      const content = (result as { content: string }).content;
      expect(content).toMatch(/achieved/i);
      expect(content).toMatch(/cleanup/);
    });
  });

  describe('clear mode', () => {
    it.each(['clear', 'stop', 'off', 'reset', 'none', 'cancel'])(
      'accepts "%s" as a clear alias',
      async (alias) => {
        manager.setGoal('working on something');
        await goalCommand.action!(ctx, alias);
        expect(manager.hasActiveGoal()).toBe(false);
      },
    );

    it('case-insensitive', async () => {
      manager.setGoal('x');
      await goalCommand.action!(ctx, 'CLEAR');
      expect(manager.hasActiveGoal()).toBe(false);
    });

    it('reports "no active goal" when nothing was set', async () => {
      const result = await goalCommand.action!(ctx, 'clear');
      expect((result as { content: string }).content).toMatch(/no active/i);
    });
  });

  describe('set mode', () => {
    it('sets the goal and returns a submit_prompt for the first turn', async () => {
      const result = await goalCommand.action!(
        ctx,
        'all tests in test/auth pass',
      );
      expect(result).toEqual({
        type: 'submit_prompt',
        content: 'all tests in test/auth pass',
      });
      expect(manager.hasActiveGoal()).toBe(true);
      expect(manager.getActiveGoal()?.condition).toBe(
        'all tests in test/auth pass',
      );
    });

    it('trims surrounding whitespace from the condition', async () => {
      await goalCommand.action!(ctx, '   build is clean   ');
      expect(manager.getActiveGoal()?.condition).toBe('build is clean');
    });

    it('rejects conditions over 4000 characters', async () => {
      const big = 'x'.repeat(4001);
      const result = await goalCommand.action!(ctx, big);
      expect(result).toMatchObject({
        type: 'message',
        messageType: 'error',
      });
      expect((result as { content: string }).content).toMatch(/4000/);
      expect(manager.hasActiveGoal()).toBe(false);
    });

    it('replaces an existing active goal', async () => {
      manager.setGoal('first');
      await goalCommand.action!(ctx, 'second');
      expect(manager.getActiveGoal()?.condition).toBe('second');
    });
  });
});

describe('goalCommand statusText', () => {
  it('renders the no-goal message', () => {
    expect(statusText(new GoalManager())).toMatch(/no active goal/i);
  });

  it('renders an active goal with recent reason', () => {
    const m = new GoalManager();
    m.setGoal('build clean');
    m.recordTurn();
    m.recordEvaluation({ met: false, reason: 'lint failing', tokensUsed: 10 });
    const text = statusText(m);
    expect(text).toMatch(/active goal/i);
    expect(text).toMatch(/build clean/);
    expect(text).toMatch(/lint failing/);
    expect(text).toMatch(/1 turn/);
  });
});
