/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENABLE = '\x1b[?1002h\x1b[?1006h';
const DISABLE = '\x1b[?1006l\x1b[?1002l';

describe('mouse', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
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

  it('enables and disables SGR mouse reporting when stdout is a TTY', async () => {
    setTTY(true);
    const { enableMouse, disableMouse, isMouseActive } = await import(
      './mouse.js'
    );

    expect(isMouseActive()).toBe(false);

    enableMouse();
    expect(vi.mocked(process.stdout.write)).toHaveBeenCalledWith(ENABLE);
    expect(isMouseActive()).toBe(true);

    disableMouse();
    expect(vi.mocked(process.stdout.write)).toHaveBeenCalledWith(DISABLE);
    expect(isMouseActive()).toBe(false);
  });

  it('is a no-op when stdout is not a TTY', async () => {
    setTTY(false);
    const { enableMouse, isMouseActive } = await import('./mouse.js');

    enableMouse();
    expect(isMouseActive()).toBe(false);
    expect(vi.mocked(process.stdout.write)).not.toHaveBeenCalledWith(ENABLE);
  });

  it('is idempotent: a second enable does not re-emit', async () => {
    setTTY(true);
    const { enableMouse } = await import('./mouse.js');

    enableMouse();
    enableMouse();

    const enables = vi
      .mocked(process.stdout.write)
      .mock.calls.filter((c) => c[0] === ENABLE);
    expect(enables).toHaveLength(1);
  });

  it('disable is a no-op when not active', async () => {
    setTTY(true);
    const { disableMouse } = await import('./mouse.js');

    disableMouse();
    expect(vi.mocked(process.stdout.write)).not.toHaveBeenCalledWith(DISABLE);
  });

  it('installs a synchronous process exit backstop on first enable', async () => {
    setTTY(true);
    const { enableMouse } = await import('./mouse.js');

    enableMouse();

    const exitHandlers = vi
      .mocked(process.on)
      .mock.calls.filter((c) => c[0] === 'exit');
    expect(exitHandlers).toHaveLength(1);
  });
});
