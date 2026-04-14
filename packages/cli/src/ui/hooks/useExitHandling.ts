/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import type React from 'react';
import { StreamingState } from '../types.js';

const CTRL_EXIT_PROMPT_DURATION_MS = 1000;

interface UseExitHandlingParams {
  isAuthDialogOpen: boolean;
  handleSlashCommand: (cmd: string) => void;
  closeAnyOpenDialog: () => boolean;
  streamingState: StreamingState;
  cancelOngoingRequest: (() => void) | undefined;
  buffer: { text: string; setText: (v: string) => void };
}

interface UseExitHandlingReturn {
  handleExit: (
    pressedOnce: boolean,
    setPressedOnce: (v: boolean) => void,
    timerRef: React.MutableRefObject<NodeJS.Timeout | null>,
  ) => void;
}

/**
 * Encapsulates the ctrl-C / ctrl-D / escape exit logic.
 */
export function useExitHandling(
  params: UseExitHandlingParams,
): UseExitHandlingReturn {
  const {
    isAuthDialogOpen,
    handleSlashCommand,
    closeAnyOpenDialog,
    streamingState,
    cancelOngoingRequest,
    buffer,
  } = params;

  const handleExit = useCallback(
    (
      pressedOnce: boolean,
      setPressedOnce: (value: boolean) => void,
      timerRef: React.MutableRefObject<NodeJS.Timeout | null>,
    ) => {
      // Fast double-press: Direct quit (preserve user habit)
      if (pressedOnce) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        // Exit directly
        handleSlashCommand('/quit');
        return;
      }

      // First press: Prioritize cleanup tasks

      // 1. Close other dialogs (highest priority)
      /**
       * For AuthDialog it is required to complete the authentication process,
       * otherwise user cannot proceed to the next step.
       * So a quit on AuthDialog should go with normal two press quit.
       */
      if (isAuthDialogOpen) {
        setPressedOnce(true);
        timerRef.current = setTimeout(() => {
          setPressedOnce(false);
        }, 500);
        return;
      }

      // 2. Close other dialogs (highest priority)
      if (closeAnyOpenDialog()) {
        return; // Dialog closed, end processing
      }

      // 3. Cancel ongoing requests
      if (streamingState === StreamingState.Responding) {
        cancelOngoingRequest?.();
        return; // Request cancelled, end processing
      }

      // 4. Clear input buffer (if has content)
      if (buffer.text.length > 0) {
        buffer.setText('');
        return; // Input cleared, end processing
      }

      // All cleanup tasks completed, set flag for double-press to quit
      setPressedOnce(true);
      timerRef.current = setTimeout(() => {
        setPressedOnce(false);
      }, CTRL_EXIT_PROMPT_DURATION_MS);
    },
    [
      isAuthDialogOpen,
      handleSlashCommand,
      closeAnyOpenDialog,
      streamingState,
      cancelOngoingRequest,
      buffer,
    ],
  );

  return { handleExit };
}
