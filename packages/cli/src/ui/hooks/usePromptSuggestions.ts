/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import {
  type Config,
  generatePromptSuggestion,
  logPromptSuggestion,
  PromptSuggestionEvent,
  startSpeculation,
  abortSpeculation,
  type SpeculationState,
  IDLE_SPECULATION,
  ApprovalMode,
} from '@qwen-code/qwen-code-core';
import { type LoadedSettings } from '../../config/settings.js';
import {
  type HistoryItem,
  type HistoryItemWithoutId,
  StreamingState,
} from '../types.js';

interface UsePromptSuggestionsParams {
  config: Config;
  settings: LoadedSettings;
  streamingState: StreamingState;
  geminiClient: ReturnType<Config['getGeminiClient']>;
  historyManager: { history: HistoryItem[] };
  shellConfirmationRequest: unknown;
  confirmationRequest: unknown;
  loopDetectionConfirmationRequest: unknown;
  isPermissionsDialogOpen: boolean;
  settingInputRequests: unknown[];
  pendingGeminiHistoryItems: HistoryItemWithoutId[];
}

interface UsePromptSuggestionsReturn {
  promptSuggestion: string | null;
  setPromptSuggestion: React.Dispatch<React.SetStateAction<string | null>>;
  dismissPromptSuggestion: () => void;
  speculationRef: React.MutableRefObject<SpeculationState>;
}

/**
 * Manages prompt suggestion generation, speculation, and dismissal.
 */
export function usePromptSuggestions(
  params: UsePromptSuggestionsParams,
): UsePromptSuggestionsReturn {
  const {
    config,
    settings,
    streamingState,
    geminiClient,
    historyManager,
    shellConfirmationRequest,
    confirmationRequest,
    loopDetectionConfirmationRequest,
    isPermissionsDialogOpen,
    settingInputRequests,
    pendingGeminiHistoryItems,
  } = params;

  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null);
  const prevStreamingStateRef = useRef<StreamingState>(StreamingState.Idle);
  const speculationRef = useRef<SpeculationState>(IDLE_SPECULATION);
  const suggestionAbortRef = useRef<AbortController | null>(null);

  // Dismiss callback — clears suggestion + aborts in-flight generation/speculation
  const dismissPromptSuggestion = useCallback(() => {
    setPromptSuggestion(null);
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;
  }, []);

  // Generate prompt suggestions when streaming completes
  const followupSuggestionsEnabled =
    settings.merged.ui?.enableFollowupSuggestions !== false;

  useEffect(() => {
    // Clear suggestion when feature is disabled at runtime
    if (!followupSuggestionsEnabled) {
      suggestionAbortRef.current?.abort();
      setPromptSuggestion(null);
      if (speculationRef.current.status === 'running') {
        abortSpeculation(speculationRef.current).catch(() => {});
        speculationRef.current = IDLE_SPECULATION;
      }
    }

    // Clear suggestion and abort pending generation/speculation when a new turn starts
    if (
      prevStreamingStateRef.current === StreamingState.Idle &&
      streamingState === StreamingState.Responding
    ) {
      suggestionAbortRef.current?.abort();
      setPromptSuggestion(null);
      if (speculationRef.current.status !== 'idle') {
        abortSpeculation(speculationRef.current).catch(() => {});
        speculationRef.current = IDLE_SPECULATION;
      }
    }

    // Only trigger when transitioning from Responding to Idle (and enabled)
    // Skip when dialogs are active, in plan mode, elicitation pending, or last response was error
    if (
      followupSuggestionsEnabled &&
      config.isInteractive() &&
      !config.getSdkMode() &&
      prevStreamingStateRef.current === StreamingState.Responding &&
      streamingState === StreamingState.Idle &&
      // Check both committed history and pending items for errors
      // (API errors go to pendingGeminiHistoryItems, not historyManager.history)
      historyManager.history[historyManager.history.length - 1]?.type !==
        'error' &&
      !pendingGeminiHistoryItems.some((item) => item.type === 'error') &&
      !shellConfirmationRequest &&
      !confirmationRequest &&
      !loopDetectionConfirmationRequest &&
      !isPermissionsDialogOpen &&
      settingInputRequests.length === 0 &&
      config.getApprovalMode() !== ApprovalMode.PLAN
    ) {
      const ac = new AbortController();
      suggestionAbortRef.current = ac;

      // Use curated history to avoid invalid/empty entries causing API errors
      const fullHistory = geminiClient.getChat().getHistory(true);
      const conversationHistory =
        fullHistory.length > 40 ? fullHistory.slice(-40) : fullHistory;
      generatePromptSuggestion(config, conversationHistory, ac.signal, {
        enableCacheSharing: settings.merged.ui?.enableCacheSharing === true,
        model: settings.merged.fastModel || undefined,
      })
        .then((result) => {
          if (ac.signal.aborted) return;
          if (result.suggestion) {
            setPromptSuggestion(result.suggestion);
            // Start speculation if enabled (runs in background)
            if (settings.merged.ui?.enableSpeculation) {
              startSpeculation(config, result.suggestion, ac.signal, {
                model: settings.merged.fastModel || undefined,
              })
                .then((state) => {
                  speculationRef.current = state;
                })
                .catch(() => {
                  // Speculation failure is non-blocking
                });
            }
          } else if (result.filterReason) {
            // Log suppressed suggestion for analytics
            logPromptSuggestion(
              config,
              new PromptSuggestionEvent({
                outcome: 'suppressed',
                reason: result.filterReason,
              }),
            );
          }
        })
        .catch(() => {
          // Silently degrade — don't disrupt the user experience
        });
    }

    // Only update prev ref when streamingState actually changes, so that
    // dialog-dependency re-runs don't cause us to miss a Responding→Idle transition.
    if (prevStreamingStateRef.current !== streamingState) {
      prevStreamingStateRef.current = streamingState;
    }

    return () => {
      suggestionAbortRef.current?.abort();
      // Cleanup speculation on unmount (#21)
      if (speculationRef.current.status !== 'idle') {
        abortSpeculation(speculationRef.current).catch(() => {});
        speculationRef.current = IDLE_SPECULATION;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guards may change independently
  }, [
    streamingState,
    followupSuggestionsEnabled,
    shellConfirmationRequest,
    confirmationRequest,
    loopDetectionConfirmationRequest,
    isPermissionsDialogOpen,
    settingInputRequests,
  ]);

  // Abort speculation when promptSuggestion is cleared (new turn, feature toggle, or
  // user-initiated dismiss via typing/paste). InputPrompt calls onPromptSuggestionDismiss
  // on user input, which clears promptSuggestion, triggering this effect to abort speculation.
  useEffect(() => {
    if (!promptSuggestion && speculationRef.current.status !== 'idle') {
      abortSpeculation(speculationRef.current).catch(() => {});
      speculationRef.current = IDLE_SPECULATION;
    }
  }, [promptSuggestion]);

  return {
    promptSuggestion,
    setPromptSuggestion,
    dismissPromptSuggestion,
    speculationRef,
  };
}
