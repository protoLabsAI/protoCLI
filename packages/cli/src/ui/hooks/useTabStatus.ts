/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { StreamingState } from '../types.js';
import {
  buildTabStatus,
  buildClearTabStatus,
  type TabStatusKind,
} from '../utils/terminalTabStatus.js';

/**
 * Map the session's streaming state to a tab-status kind.
 * Responding → busy, waiting-for-confirmation → waiting, everything else → idle.
 */
export function tabStatusKindForStreamingState(
  state: StreamingState,
): TabStatusKind {
  switch (state) {
    case StreamingState.Responding:
      return 'busy';
    case StreamingState.WaitingForConfirmation:
      return 'waiting';
    default:
      return 'idle';
  }
}

/**
 * Declaratively drive the terminal tab-status indicator (OSC 21337). Emits a
 * sequence only when the kind changes, so there's no per-frame churn. Passing
 * `null` opts out and clears any previously-set indicator.
 */
export function useTabStatus(
  kind: TabStatusKind | null,
  stdout: NodeJS.WriteStream,
): void {
  const prevKindRef = useRef<TabStatusKind | null>(null);

  useEffect(() => {
    if (kind === null) {
      // Clear a previously-set indicator when toggling off mid-session.
      if (prevKindRef.current !== null) {
        stdout.write(buildClearTabStatus());
        prevKindRef.current = null;
      }
      return;
    }

    if (prevKindRef.current === kind) return;
    prevKindRef.current = kind;
    stdout.write(buildTabStatus(kind));
  }, [kind, stdout]);
}
