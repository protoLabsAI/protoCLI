/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { enterAltScreen, leaveAltScreen } from '../../utils/altScreen.js';
import { enableMouse, disableMouse } from '../../utils/mouse.js';
import {
  startShadowTerminal,
  stopShadowTerminal,
} from '../utils/shadowTerminal.js';
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
 */
export function useFullScreen(enabled: boolean): boolean {
  const [active] = useState(enabled);

  useEffect(() => {
    if (!active) return;
    // Start the shadow terminal BEFORE entering the alt-screen so it captures
    // the ?1049h switch and mirrors the alternate buffer from the start.
    startShadowTerminal();
    enterAltScreen();
    enableMouse();
    // Restore the screen + native selection as part of the normal cleanup chain
    // (runs before Ink unmounts); each util's own `process.on('exit')` backstop
    // covers hard exits.
    registerCleanup(disableMouse);
    registerCleanup(leaveAltScreen);
    registerCleanup(stopShadowTerminal);
    return () => {
      disableMouse();
      leaveAltScreen();
      stopShadowTerminal();
    };
  }, [active]);

  return active;
}
