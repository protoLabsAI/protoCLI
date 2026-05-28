/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { StreamingState } from '../types.js';
import {
  useTabStatus,
  tabStatusKindForStreamingState,
} from './useTabStatus.js';

function makeStdout(): { stdout: NodeJS.WriteStream; writes: string[] } {
  const writes: string[] = [];
  const stdout = {
    write: vi.fn((s: string) => {
      writes.push(s);
      return true;
    }),
  } as unknown as NodeJS.WriteStream;
  return { stdout, writes };
}

describe('tabStatusKindForStreamingState', () => {
  it('maps streaming states to tab-status kinds', () => {
    expect(tabStatusKindForStreamingState(StreamingState.Responding)).toBe(
      'busy',
    );
    expect(
      tabStatusKindForStreamingState(StreamingState.WaitingForConfirmation),
    ).toBe('waiting');
    expect(tabStatusKindForStreamingState(StreamingState.Idle)).toBe('idle');
    expect(tabStatusKindForStreamingState(StreamingState.Backgrounded)).toBe(
      'idle',
    );
  });
});

describe('useTabStatus', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('emits a status sequence on mount', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() => useTabStatus('busy', stdout));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('21337;');
    expect(writes[0]).toContain('status=Working…');
  });

  it('does not re-emit when the kind is unchanged', () => {
    const { stdout, writes } = makeStdout();
    const { rerender } = renderHook(({ k }) => useTabStatus(k, stdout), {
      initialProps: { k: 'busy' as const },
    });
    expect(writes).toHaveLength(1);
    rerender({ k: 'busy' as const });
    expect(writes).toHaveLength(1);
  });

  it('emits a new sequence when the kind changes', () => {
    const { stdout, writes } = makeStdout();
    const { rerender } = renderHook(
      ({ k }: { k: 'busy' | 'idle' }) => useTabStatus(k, stdout),
      { initialProps: { k: 'busy' } },
    );
    rerender({ k: 'idle' });
    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain('status=Idle');
  });

  it('clears the indicator when transitioning to null', () => {
    const { stdout, writes } = makeStdout();
    const { rerender } = renderHook(
      ({ k }: { k: 'busy' | null }) => useTabStatus(k, stdout),
      { initialProps: { k: 'busy' } },
    );
    rerender({ k: null });
    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain('indicator=;status=;status-color=');
  });

  it('does not emit anything when null from the start', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() => useTabStatus(null, stdout));
    expect(writes).toHaveLength(0);
  });
});
