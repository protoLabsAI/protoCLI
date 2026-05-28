/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildTabStatus,
  buildClearTabStatus,
  wrapForMultiplexer,
} from './terminalTabStatus.js';

const BEL = '\x07';
const ESC = '\x1b';

describe('terminalTabStatus', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('builds an OSC 21337 sequence for the busy state', () => {
    vi.stubEnv('TERM', 'alacritty');
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '');
    const seq = buildTabStatus('busy');
    expect(seq.startsWith(`${ESC}]21337;`)).toBe(true);
    expect(seq).toContain('indicator=#ff9500');
    expect(seq).toContain('status=Working…');
    expect(seq).toContain('status-color=#ff9500');
    expect(seq.endsWith(BEL)).toBe(true);
  });

  it('maps idle and waiting to their preset colors', () => {
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '');
    expect(buildTabStatus('idle')).toContain(
      'indicator=#00d75f;status=Idle;status-color=#888888',
    );
    expect(buildTabStatus('waiting')).toContain(
      'indicator=#5f87ff;status=Waiting;status-color=#5f87ff',
    );
  });

  it('clears all three fields', () => {
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '');
    expect(buildClearTabStatus()).toContain(
      '21337;indicator=;status=;status-color=',
    );
  });

  it('uses the ST terminator under kitty (avoids BEL beep)', () => {
    vi.stubEnv('TERM', 'xterm-kitty');
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '');
    const seq = buildTabStatus('idle');
    expect(seq.endsWith(`${ESC}\\`)).toBe(true);
    expect(seq.endsWith(BEL)).toBe(false);
  });

  it('wraps for tmux passthrough when $TMUX is set', () => {
    vi.stubEnv('TMUX', '/tmp/tmux-1000/default,1,0');
    vi.stubEnv('STY', '');
    const seq = buildTabStatus('busy');
    expect(seq.startsWith(`${ESC}Ptmux;`)).toBe(true);
    expect(seq.endsWith(`${ESC}\\`)).toBe(true);
    // Inner ESCs are doubled for tmux passthrough.
    expect(seq).toContain(`${ESC}${ESC}]21337;`);
  });

  it('wraps for GNU screen passthrough when $STY is set', () => {
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '12345.pts-0.host');
    const seq = wrapForMultiplexer('PAYLOAD');
    expect(seq).toBe(`${ESC}PPAYLOAD${ESC}\\`);
  });

  it('is a no-op outside a multiplexer', () => {
    vi.stubEnv('TMUX', '');
    vi.stubEnv('STY', '');
    expect(wrapForMultiplexer('PAYLOAD')).toBe('PAYLOAD');
  });
});
