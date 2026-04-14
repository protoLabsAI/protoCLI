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
 * Manages the terminal window title, reflecting streaming state and thought
 * subject. Owns the originalTitleRef and lastTitleRef internally.
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

    let title;
    if (streamingState === StreamingState.Idle) {
      title = originalTitleRef.current;
    } else {
      const statusText = thought?.subject
        ?.replace(/[\r\n]+/g, ' ')
        .substring(0, 80);
      title = statusText || originalTitleRef.current;
    }

    // Pad the title to a fixed width to prevent taskbar icon resizing.
    const paddedTitle = title.padEnd(80, ' ');

    // Only update the title if it's different from the last value we set
    if (lastTitleRef.current !== paddedTitle) {
      lastTitleRef.current = paddedTitle;
      stdout.write(`\x1b[?2026h\x1b]2;${paddedTitle}\x07\x1b[?2026l`);
    }
    // Note: We don't need to reset the window title on exit because proto is already doing that elsewhere
  }, [
    streamingState,
    thought,
    settings.merged.ui?.showStatusInTitle,
    settings.merged.ui?.hideWindowTitle,
    stdout,
  ]);
}
