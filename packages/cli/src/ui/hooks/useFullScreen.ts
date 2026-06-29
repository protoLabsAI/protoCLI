/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { enterAltScreen, leaveAltScreen } from '../../utils/altScreen.js';
import { registerCleanup } from '../../utils/cleanup.js';

/**
 * Drives the alternate-screen lifecycle for full-screen mode.
 *
 * Takes the already-resolved decision (the caller combines the `ui.fullScreen`
 * setting, the `PROTO_FULLSCREEN` env escape hatch, and the screen-reader veto).
 * Enters the alternate screen on mount and leaves it on unmount; also registers
 * a cleanup so the screen is restored before Ink unmounts on a normal exit. The
 * decision is captured once on mount so toggling the setting mid-session does
 * not flip the renderer underneath a running turn — it takes effect on restart,
 * matching the `requiresRestart` flag on the setting.
 *
 * Full-screen deliberately does NOT capture the mouse. Capturing it (SGR mouse
 * reporting) would let proto draw its own scroll/selection, but it disables the
 * terminal's native text selection — and reproducing a native-feeling selection
 * highlight on top of Ink proved intractable (Ink clears and rewrites the whole
 * alt-screen every commit, so any overlay is stomped). Every TUI that captures
 * the mouse also inherits a long bug tail: broken scrollback, terminal Find,
 * tmux copy-mode, and screen-reader selection. So we leave the mouse to the
 * terminal — native selection + copy just work — and scroll via PgUp/PgDn.
 */
export function useFullScreen(enabled: boolean): boolean {
  const [active] = useState(enabled);

  useEffect(() => {
    if (!active) return;
    enterAltScreen();
    // Restore the screen as part of the normal cleanup chain (runs before Ink
    // unmounts); altScreen's own `process.on('exit')` backstop covers hard exits.
    registerCleanup(leaveAltScreen);
    return () => {
      leaveAltScreen();
    };
  }, [active]);

  return active;
}
