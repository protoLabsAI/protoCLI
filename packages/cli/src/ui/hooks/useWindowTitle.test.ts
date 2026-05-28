/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StreamingState, type ThoughtSummary } from '../types.js';
import type { LoadedSettings } from '../../config/settings.js';
import { computeWindowTitle } from '../../utils/windowTitle.js';
import { useWindowTitle } from './useWindowTitle.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function makeSettings(ui: {
  showStatusInTitle?: boolean;
  hideWindowTitle?: boolean;
}): LoadedSettings {
  return { merged: { ui } } as unknown as LoadedSettings;
}

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

const thought = (subject: string) => ({ subject }) as unknown as ThoughtSummary;
const hasSpinner = (s: string) => SPINNER_FRAMES.some((g) => s.includes(g));

const TARGET = '/work/myrepo';

describe('useWindowTitle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes nothing when showStatusInTitle is disabled', () => {
    const { stdout } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.Responding,
        null,
        makeSettings({ showStatusInTitle: false }),
        stdout,
        TARGET,
      ),
    );
    expect(stdout.write).not.toHaveBeenCalled();
  });

  it('writes nothing when hideWindowTitle is set', () => {
    const { stdout } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.Responding,
        null,
        makeSettings({ showStatusInTitle: true, hideWindowTitle: true }),
        stdout,
        TARGET,
      ),
    );
    expect(stdout.write).not.toHaveBeenCalled();
  });

  it('writes a plain, spinner-free title when idle', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.Idle,
        null,
        makeSettings({ showStatusInTitle: true }),
        stdout,
        TARGET,
      ),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain(computeWindowTitle('myrepo'));
    expect(hasSpinner(writes[0]!)).toBe(false);
  });

  it('animates a spinner through its frames while responding', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.Responding,
        thought('editing parser.ts'),
        makeSettings({ showStatusInTitle: true }),
        stdout,
        TARGET,
      ),
    );
    // First frame is written synchronously when the effect runs.
    expect(writes[0]).toContain(SPINNER_FRAMES[0]);
    expect(writes[0]).toContain('editing parser.ts');
    // Each interval tick advances to the next frame.
    act(() => vi.advanceTimersByTime(100));
    expect(writes[1]).toContain(SPINNER_FRAMES[1]);
    act(() => vi.advanceTimersByTime(100));
    expect(writes[2]).toContain(SPINNER_FRAMES[2]);
  });

  it('shows status without a spinner while waiting for confirmation', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.WaitingForConfirmation,
        thought('approve edit'),
        makeSettings({ showStatusInTitle: true }),
        stdout,
        TARGET,
      ),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('approve edit');
    expect(hasSpinner(writes[0]!)).toBe(false);
    // No animation timer for this state.
    act(() => vi.advanceTimersByTime(500));
    expect(writes).toHaveLength(1);
  });

  it('stops animating and resets to the plain title on return to idle', () => {
    const { stdout, writes } = makeStdout();
    const { rerender } = renderHook(
      ({ s }: { s: StreamingState }) =>
        useWindowTitle(
          s,
          thought('working'),
          makeSettings({ showStatusInTitle: true }),
          stdout,
          TARGET,
        ),
      { initialProps: { s: StreamingState.Responding } },
    );
    act(() => vi.advanceTimersByTime(100));
    expect(hasSpinner(writes[writes.length - 1]!)).toBe(true);

    rerender({ s: StreamingState.Idle });
    const idleWrite = writes[writes.length - 1]!;
    expect(hasSpinner(idleWrite)).toBe(false);
    expect(idleWrite).toContain(computeWindowTitle('myrepo'));

    // The interval was torn down — no further frames are emitted.
    const countAfterIdle = writes.length;
    act(() => vi.advanceTimersByTime(500));
    expect(writes).toHaveLength(countAfterIdle);
  });
});
