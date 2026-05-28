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
 * Braille spinner frames, cycled in the terminal tab title while proto is
 * actively responding. The point is at-a-glance "running vs stopped" across
 * multiple terminal tabs: a spinning tab is working, a plain one is idle.
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 100;

/**
 * Manages the terminal window/tab title, reflecting streaming state and thought
 * subject. While proto is responding the title is prefixed with an animated
 * spinner; when idle it falls back to the plain workspace title. Owns the
 * originalTitleRef and lastTitleRef internally.
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

    const writeTitle = (title: string) => {
      // Pad the title to a fixed width to prevent taskbar icon resizing.
      const paddedTitle = title.padEnd(80, ' ');
      // Skip redundant writes (idle/static cases). The animated frames always
      // differ, so this never suppresses an animation tick.
      if (lastTitleRef.current === paddedTitle) return;
      lastTitleRef.current = paddedTitle;
      stdout.write(`\x1b[?2026h\x1b]2;${paddedTitle}\x07\x1b[?2026l`);
    };

    if (streamingState === StreamingState.Idle) {
      writeTitle(originalTitleRef.current);
      return;
    }

    const statusText =
      thought?.subject?.replace(/[\r\n]+/g, ' ').substring(0, 80) ||
      originalTitleRef.current;

    // Only the actively-responding state animates. Other non-idle states
    // (waiting for confirmation, backgrounded) aren't actively computing, so
    // they show the status text without a spinner.
    if (streamingState !== StreamingState.Responding) {
      writeTitle(statusText);
      return;
    }

    let frame = 0;
    const renderFrame = () => {
      const glyph = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
      writeTitle(`${glyph} ${statusText}`);
      frame++;
    };
    renderFrame();
    const intervalId = setInterval(renderFrame, SPINNER_INTERVAL_MS);
    return () => clearInterval(intervalId);
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
