/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GoalManager } from '@qwen-code/qwen-code-core';
import type { Config } from '@qwen-code/qwen-code-core';
import { useGoalStatus } from './useGoalStatus.js';

function makeConfig(manager: GoalManager): Config {
  return {
    getGoalManager: () => manager,
  } as unknown as Config;
}

describe('useGoalStatus', () => {
  let manager: GoalManager;
  let config: Config;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new GoalManager();
    config = makeConfig(manager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no goal is active', () => {
    const { result } = renderHook(() => useGoalStatus(config));
    expect(result.current).toBeNull();
  });

  it('returns null when config is null', () => {
    const { result } = renderHook(() => useGoalStatus(null));
    expect(result.current).toBeNull();
  });

  it('picks up an active goal on the first tick', () => {
    manager.setGoal('all tests pass');
    const { result } = renderHook(() => useGoalStatus(config));
    expect(result.current).not.toBeNull();
    expect(result.current?.condition).toBe('all tests pass');
    expect(result.current?.turnCount).toBe(0);
  });

  it('updates when the goal advances a turn', async () => {
    manager.setGoal('build clean');
    const { result } = renderHook(() => useGoalStatus(config));
    expect(result.current?.turnCount).toBe(0);

    act(() => {
      manager.recordTurn();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current?.turnCount).toBe(1);
  });

  it('clears the snapshot when the goal is cleared', async () => {
    manager.setGoal('x');
    const { result } = renderHook(() => useGoalStatus(config));
    expect(result.current).not.toBeNull();

    act(() => {
      manager.clearGoal();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBeNull();
  });

  it('clears the snapshot when the goal is achieved', async () => {
    manager.setGoal('all done');
    const { result } = renderHook(() => useGoalStatus(config));
    expect(result.current).not.toBeNull();

    act(() => {
      manager.markAchieved();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBeNull();
  });

  it('returns a stable reference when nothing rendered-relevant changed', async () => {
    manager.setGoal('keep watching');
    const { result } = renderHook(() => useGoalStatus(config));
    const first = result.current;

    // tokensSpent changes don't affect the pill so they should not bump the
    // snapshot reference (preserves React-equality for the consumer).
    act(() => {
      manager.recordEvaluation({
        met: false,
        reason: 'not yet',
        tokensUsed: 50,
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe(first);
  });

  it('tolerates a config without getGoalManager (test mocks)', () => {
    const partialConfig = {} as Config;
    const { result } = renderHook(() => useGoalStatus(partialConfig));
    expect(result.current).toBeNull();
  });
});
