/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { StreamingState } from '../types.js';

/**
 * Idle drain: submit any messages still in the queue when the turn ends.
 * Most messages are injected mid-turn via handleCompletedTools.drain(),
 * but pure text turns (no tool calls) need this fallback.
 */
export function useIdleMessageDrain(
  isConfigInitialized: boolean,
  streamingState: StreamingState,
  messageQueue: readonly string[],
  drain: () => void,
  submitQuery: (text: string) => void,
): void {
  useEffect(() => {
    if (
      isConfigInitialized &&
      streamingState === StreamingState.Idle &&
      messageQueue.length > 0
    ) {
      const combined = messageQueue.join('\n\n');
      drain();
      submitQuery(combined);
    }
  }, [isConfigInitialized, streamingState, messageQueue, drain, submitQuery]);
}
