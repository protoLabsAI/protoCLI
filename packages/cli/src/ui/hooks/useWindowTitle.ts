/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { basename } from 'node:path';
import { StreamingState, type ThoughtSummary } from '../types.js';
import { type LoadedSettings } from '../../config/settings.js';
import { computeWindowTitle } from '../../utils/windowTitle.js';

/**
 * Static state glyphs prefixed to the terminal tab title so you can tell at a
 * glance which tabs are working vs idle across multiple terminal tabs.
 *
 * Deliberately NOT animated: a previous spinner rewrote the title ~10x/sec,
 * which fought Ink's renderer and caused noticeable input lag. The title is now
 * written once per state change.
 */
const GLYPH_ACTIVE = '●'; // proto is doing something
const GLYPH_IDLE = '○'; // proto is idle / waiting

/**
 * Manages the terminal window/tab title, reflecting streaming state and thought
 * subject. The title is prefixed with a solid dot while proto is actively
 * responding and a hollow dot otherwise. Owns the originalTitleRef and
 * lastTitleRef internally.
 *
 * Gated behind `ui.showStatusInTitle` (and disabled by `ui.hideWindowTitle`).
 */
export function useWindowTitle(
  streamingState: StreamingState,
  thought: ThoughtSummary | null | undefined,
  settings: LoadedSettings,
  stdout: NodeJS.WriteStream,
  targetDir: string,
): void {
  const originalTitleRef = useRef(computeWindowTitle(basename(targetDir)));
  const lastTitleRef = useRef<string | null>(null);

  useEffect(() => {
    // Respect both showStatusInTitle and hideWindowTitle settings
    if (
      !settings.merged.ui?.showStatusInTitle ||
      settings.merged.ui?.hideWindowTitle
    )
      return;

    const isActive = streamingState === StreamingState.Responding;
    const glyph = isActive ? GLYPH_ACTIVE : GLYPH_IDLE;

    // Idle shows the plain workspace title; any non-idle state surfaces the
    // current thought subject when one is available.
    const text =
      streamingState === StreamingState.Idle
        ? originalTitleRef.current
        : thought?.subject?.replace(/[\r\n]+/g, ' ').substring(0, 80) ||
          originalTitleRef.current;

    // Pad to a fixed width to prevent taskbar icon resizing.
    const paddedTitle = `${glyph} ${text}`.padEnd(80, ' ');

    // Only update the title if it changed from the last value we set.
    if (lastTitleRef.current !== paddedTitle) {
      lastTitleRef.current = paddedTitle;
      stdout.write(`\x1b[?2026h\x1b]2;${paddedTitle}\x07\x1b[?2026l`);
    }
    // Note: We don't need to reset the window title on exit because proto is
    // already doing that elsewhere.
  }, [
    streamingState,
    thought,
    settings.merged.ui?.showStatusInTitle,
    settings.merged.ui?.hideWindowTitle,
    stdout,
  ]);
}
