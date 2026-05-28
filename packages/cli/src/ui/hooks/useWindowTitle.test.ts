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

const GLYPH_ACTIVE = '●';
const GLYPH_IDLE = '○';

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

  it('prefixes a hollow dot and the plain title when idle', () => {
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
    expect(writes[0]).toContain(
      `${GLYPH_IDLE} ${computeWindowTitle('myrepo')}`,
    );
    expect(writes[0]).not.toContain(GLYPH_ACTIVE);
  });

  it('prefixes a solid dot and the status while responding', () => {
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
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain(`${GLYPH_ACTIVE} editing parser.ts`);
  });

  it('does not animate — no further writes over time (regression guard)', () => {
    const { stdout, writes } = makeStdout();
    renderHook(() =>
      useWindowTitle(
        StreamingState.Responding,
        thought('working'),
        makeSettings({ showStatusInTitle: true }),
        stdout,
        TARGET,
      ),
    );
    expect(writes).toHaveLength(1);
    // A previous animated implementation rewrote the title on a 100ms timer,
    // which caused input lag. There must be no timer-driven extra writes.
    act(() => vi.advanceTimersByTime(2000));
    expect(writes).toHaveLength(1);
  });

  it('uses the hollow dot while waiting for confirmation', () => {
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
    expect(writes[0]).toContain(`${GLYPH_IDLE} approve edit`);
    expect(writes[0]).not.toContain(GLYPH_ACTIVE);
  });

  it('flips the dot from solid to hollow on return to idle', () => {
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
    expect(writes[writes.length - 1]).toContain(GLYPH_ACTIVE);

    rerender({ s: StreamingState.Idle });
    const idleWrite = writes[writes.length - 1]!;
    expect(idleWrite).toContain(
      `${GLYPH_IDLE} ${computeWindowTitle('myrepo')}`,
    );
    expect(idleWrite).not.toContain(GLYPH_ACTIVE);
  });
});
