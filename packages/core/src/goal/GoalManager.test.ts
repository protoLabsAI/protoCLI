/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoalManager } from './GoalManager.js';

describe('GoalManager', () => {
  let manager: GoalManager;

  beforeEach(() => {
    manager = new GoalManager();
  });

  describe('setGoal', () => {
    it('creates a new active goal with zeroed counters', () => {
      const state = manager.setGoal('all tests pass');
      expect(state.condition).toBe('all tests pass');
      expect(state.turnCount).toBe(0);
      expect(state.tokensSpent).toBe(0);
      expect(state.achievedAt).toBeUndefined();
      expect(state.startedAt).toBeGreaterThan(0);
      expect(manager.hasActiveGoal()).toBe(true);
    });

    it('trims surrounding whitespace from the condition', () => {
      const state = manager.setGoal('  lint clean  ');
      expect(state.condition).toBe('lint clean');
    });

    it('rejects empty conditions', () => {
      expect(() => manager.setGoal('')).toThrow(/empty/);
      expect(() => manager.setGoal('   ')).toThrow(/empty/);
    });

    it('rejects conditions over 4000 characters', () => {
      expect(() => manager.setGoal('x'.repeat(4001))).toThrow(/4000/);
    });

    it('replaces an existing active goal', () => {
      manager.setGoal('first');
      manager.recordTurn();
      manager.setGoal('second');
      const active = manager.getActiveGoal();
      expect(active?.condition).toBe('second');
      expect(active?.turnCount).toBe(0);
    });
  });

  describe('clearGoal', () => {
    it('returns undefined when no goal is active', () => {
      expect(manager.clearGoal()).toBeUndefined();
    });

    it('clears an active goal and returns its final state', () => {
      manager.setGoal('cleanup queue');
      manager.recordTurn();
      const cleared = manager.clearGoal();
      expect(cleared?.condition).toBe('cleanup queue');
      expect(cleared?.turnCount).toBe(1);
      expect(manager.hasActiveGoal()).toBe(false);
    });

    it('does not affect the lastAchieved record', () => {
      manager.setGoal('done');
      manager.markAchieved();
      manager.setGoal('next');
      manager.clearGoal();
      expect(manager.getLastAchievedGoal()?.condition).toBe('done');
    });
  });

  describe('markAchieved', () => {
    it('moves the active goal into lastAchieved with achievedAt set', () => {
      manager.setGoal('migrate module');
      manager.recordTurn();
      const achieved = manager.markAchieved();
      expect(achieved?.achievedAt).toBeGreaterThan(0);
      expect(manager.hasActiveGoal()).toBe(false);
      expect(manager.getLastAchievedGoal()?.condition).toBe('migrate module');
    });

    it('returns undefined when no goal is active', () => {
      expect(manager.markAchieved()).toBeUndefined();
    });

    it('overwrites a prior achieved goal', () => {
      manager.setGoal('first');
      manager.markAchieved();
      manager.setGoal('second');
      manager.markAchieved();
      expect(manager.getLastAchievedGoal()?.condition).toBe('second');
    });
  });

  describe('markImpossible', () => {
    it('moves the active goal into lastFailed with failedAt and reason', () => {
      manager.setGoal('make 2 + 2 equal 5');
      manager.recordTurn();
      const failed = manager.markImpossible('arithmetic is fixed; impossible');
      expect(failed?.failedAt).toBeGreaterThan(0);
      expect(failed?.lastReason).toBe('arithmetic is fixed; impossible');
      expect(manager.hasActiveGoal()).toBe(false);
      expect(manager.getLastFailedGoal()?.condition).toBe('make 2 + 2 equal 5');
      expect(manager.getLastFailedGoal()?.achievedAt).toBeUndefined();
    });

    it('returns undefined when no goal is active', () => {
      expect(manager.markImpossible('n/a')).toBeUndefined();
    });

    it('does not populate lastAchieved', () => {
      manager.setGoal('x');
      manager.markImpossible('cannot');
      expect(manager.getLastAchievedGoal()).toBeUndefined();
    });
  });

  describe('recordTurn', () => {
    it('increments the active goal turn count', () => {
      manager.setGoal('x');
      manager.recordTurn();
      manager.recordTurn();
      expect(manager.getActiveGoal()?.turnCount).toBe(2);
    });

    it('is a no-op when no goal is active', () => {
      manager.recordTurn();
      expect(manager.hasActiveGoal()).toBe(false);
    });
  });

  describe('recordEvaluation', () => {
    it('stores the latest reason and accumulates tokens', () => {
      manager.setGoal('x');
      manager.recordEvaluation({
        met: false,
        reason: 'tests not run yet',
        tokensUsed: 50,
      });
      manager.recordEvaluation({
        met: false,
        reason: 'still failing',
        tokensUsed: 30,
      });
      const active = manager.getActiveGoal();
      expect(active?.lastReason).toBe('still failing');
      expect(active?.tokensSpent).toBe(80);
    });

    it('is a no-op when no goal is active', () => {
      expect(
        manager.recordEvaluation({ met: true, reason: 'ok', tokensUsed: 10 }),
      ).toBe(0);
      expect(manager.hasActiveGoal()).toBe(false);
    });
  });

  describe('recordEvaluation stall detection', () => {
    const notMet = (reason: string) => ({ met: false, reason, tokensUsed: 1 });

    it('counts consecutive not-met evaluations repeating the same reason', () => {
      manager.setGoal('x');
      expect(manager.recordEvaluation(notMet('tests not run yet'))).toBe(1);
      expect(manager.recordEvaluation(notMet('tests not run yet'))).toBe(2);
      expect(manager.recordEvaluation(notMet('tests not run yet'))).toBe(3);
    });

    it('resets the count when the reason changes (goal is converging)', () => {
      manager.setGoal('x');
      expect(manager.recordEvaluation(notMet('no test output'))).toBe(1);
      expect(manager.recordEvaluation(notMet('no test output'))).toBe(2);
      expect(manager.recordEvaluation(notMet('2 tests still failing'))).toBe(1);
    });

    it('ignores case, whitespace, and trailing punctuation differences', () => {
      manager.setGoal('x');
      expect(manager.recordEvaluation(notMet('Tests not run yet.'))).toBe(1);
      expect(manager.recordEvaluation(notMet('tests   not run yet'))).toBe(2);
      expect(manager.recordEvaluation(notMet('TESTS NOT RUN YET!!!'))).toBe(3);
    });

    it('resets the count when an evaluation comes back met', () => {
      manager.setGoal('x');
      manager.recordEvaluation(notMet('not done'));
      expect(manager.recordEvaluation(notMet('not done'))).toBe(2);
      expect(
        manager.recordEvaluation({ met: true, reason: 'done', tokensUsed: 1 }),
      ).toBe(0);
      // A subsequent not-met starts a fresh streak.
      expect(manager.recordEvaluation(notMet('not done'))).toBe(1);
    });

    it('resets the count when a new goal is set', () => {
      manager.setGoal('first');
      manager.recordEvaluation(notMet('same complaint'));
      expect(manager.recordEvaluation(notMet('same complaint'))).toBe(2);
      manager.setGoal('second');
      expect(manager.recordEvaluation(notMet('same complaint'))).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears active, achieved, and failed state', () => {
      manager.setGoal('first');
      manager.markAchieved();
      manager.setGoal('second');
      manager.markImpossible('cannot');
      manager.setGoal('third');
      manager.reset();
      expect(manager.hasActiveGoal()).toBe(false);
      expect(manager.getLastAchievedGoal()).toBeUndefined();
      expect(manager.getLastFailedGoal()).toBeUndefined();
    });
  });

  describe('getActiveGoal', () => {
    it('returns a copy that does not mutate internal state', () => {
      manager.setGoal('x');
      const snapshot = manager.getActiveGoal();
      if (snapshot) snapshot.turnCount = 999;
      expect(manager.getActiveGoal()?.turnCount).toBe(0);
    });
  });

  describe('return values are defensive copies', () => {
    it('setGoal return value does not alias internal state', () => {
      const returned = manager.setGoal('x');
      returned.turnCount = 999;
      expect(manager.getActiveGoal()?.turnCount).toBe(0);
    });

    it('clearGoal return value does not alias internal state', () => {
      manager.setGoal('y');
      manager.recordTurn();
      const cleared = manager.clearGoal();
      // Mutating the returned copy should not surface anywhere -- the
      // manager has cleared its own state. This is a regression guard
      // against the previous shape that returned the live reference.
      if (cleared) cleared.condition = 'mutated';
      expect(manager.hasActiveGoal()).toBe(false);
      // Re-setting + reading should give us the fresh condition, not the
      // mutated one (proves the reference didn't leak elsewhere).
      manager.setGoal('z');
      expect(manager.getActiveGoal()?.condition).toBe('z');
    });
  });
});
