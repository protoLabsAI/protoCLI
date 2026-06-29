/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from 'react';
import {
  useMouse,
  type MouseEvent as MouseDragEvent,
} from '../contexts/KeypressContext.js';
import { readShadowSelection, type GridPos } from '../utils/shadowTerminal.js';
import { copySelection } from '../utils/clipboard.js';

/**
 * Drag-to-select + copy for full-screen mode. Mouse-down sets the anchor, drag
 * moves the focus, and release reads the text under the drag from the shadow
 * terminal grid and copies it (OSC-52 + native).
 *
 * Follows the field's hard-won rules: copy ONLY on release (never per-frame —
 * that was Claude Code's clipboard-spam bug), and the selection state lives in
 * refs decoupled from rendering so a streaming re-render can't wipe it.
 *
 * Note: there is no live highlight yet — a live selection highlight in Ink needs
 * a different technique than a full-screen freeze-overlay (which fights Ink's
 * full-height layout). See the design notes; tracked as a follow-up.
 *
 * @param enabled whether selection is active (full-screen mode).
 * @param onCopied optional callback with the copied text (for a toast).
 */
export function useSelection(
  enabled: boolean,
  onCopied?: (text: string) => void,
): void {
  const anchorRef = useRef<GridPos | null>(null);
  const focusRef = useRef<GridPos | null>(null);

  const onMouse = useCallback(
    (event: MouseDragEvent) => {
      if (event.type === 'down') {
        anchorRef.current = { row: event.row, col: event.col };
        focusRef.current = { row: event.row, col: event.col };
        return;
      }
      if (event.type === 'drag') {
        focusRef.current = { row: event.row, col: event.col };
        return;
      }
      // release
      const anchor = anchorRef.current;
      const focus = focusRef.current;
      if (
        !anchor ||
        !focus ||
        (anchor.row === focus.row && anchor.col === focus.col)
      ) {
        return; // a click, not a drag
      }
      void readShadowSelection(anchor, focus).then((text) => {
        if (text.trim().length === 0) return;
        void copySelection(text).then((ok) => {
          if (ok) onCopied?.(text);
        });
      });
    },
    [onCopied],
  );

  useMouse(onMouse, { isActive: enabled });
}
