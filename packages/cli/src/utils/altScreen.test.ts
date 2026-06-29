/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENTER = '\x1b[?1049h';
const LEAVE = '\x1b[?1049l';

describe('altScreen', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    // Fresh module state per test (the module keeps a singleton `active` flag).
    vi.resetModules();
    originalIsTTY = process.stdout.isTTY;
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process, 'on');
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function setTTY(value: boolean) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value,
      configurable: true,
    });
  }

  it('enters and leaves with the DEC 1049 sequences when stdout is a TTY', async () => {
    setTTY(true);
    const { enterAltScreen, leaveAltScreen, isAltScreenActive } = await import(
      './altScreen.js'
    );

    expect(isAltScreenActive()).toBe(false);

    enterAltScreen();
    expect(vi.mocked(process.stdout.write)).toHaveBeenCalledWith(ENTER);
    expect(isAltScreenActive()).toBe(true);

    leaveAltScreen();
    expect(vi.mocked(process.stdout.write)).toHaveBeenCalledWith(LEAVE);
    expect(isAltScreenActive()).toBe(false);
  });

  it('is a no-op when stdout is not a TTY', async () => {
    setTTY(false);
    const { enterAltScreen, isAltScreenActive } = await import(
      './altScreen.js'
    );

    enterAltScreen();
    expect(isAltScreenActive()).toBe(false);
    expect(vi.mocked(process.stdout.write)).not.toHaveBeenCalledWith(ENTER);
  });

  it('is idempotent: a second enter does not re-emit', async () => {
    setTTY(true);
    const { enterAltScreen } = await import('./altScreen.js');

    enterAltScreen();
    enterAltScreen();

    const enters = vi
      .mocked(process.stdout.write)
      .mock.calls.filter((c) => c[0] === ENTER);
    expect(enters).toHaveLength(1);
  });

  it('leave is a no-op when not active', async () => {
    setTTY(true);
    const { leaveAltScreen } = await import('./altScreen.js');

    leaveAltScreen();
    expect(vi.mocked(process.stdout.write)).not.toHaveBeenCalledWith(LEAVE);
  });

  it('installs a synchronous process exit backstop on first enter', async () => {
    setTTY(true);
    const { enterAltScreen } = await import('./altScreen.js');

    enterAltScreen();

    const exitHandlers = vi
      .mocked(process.on)
      .mock.calls.filter((c) => c[0] === 'exit');
    expect(exitHandlers).toHaveLength(1);
  });
});
