/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import {
  type Config,
  IdeClient,
  createDebugLogger,
  SessionEndReason,
  SessionStartSource,
  runBaselineCheck,
  formatBaseline,
  type PermissionMode,
} from '@qwen-code/qwen-code-core';
import { buildResumedHistoryItems } from '../utils/resumeHistoryUtils.js';
import { registerCleanup } from '../../utils/cleanup.js';
import { type HistoryItemWithoutId, MessageType } from '../types.js';

const debugLogger = createDebugLogger('APP_CONTAINER');

/**
 * Runs the one-time initialization side effects:
 * - config.initialize()
 * - baseline check
 * - resumed session history loading
 * - SessionStart hook event
 * - SessionEnd / IDE disconnect cleanup registration
 */
export function useInitializationEffects(
  config: Config,
  historyManager: {
    addItem: (item: HistoryItemWithoutId, timestamp: number) => void;
    loadHistory: (items: ReturnType<typeof buildResumedHistoryItems>) => void;
  },
  setConfigInitialized: (v: boolean) => void,
): void {
  useEffect(() => {
    (async () => {
      // Note: the program will not work if this fails so let errors be
      // handled by the global catch.
      await config.initialize();
      setConfigInitialized(true);

      // Pre-flight baseline check: establish project state before the
      // agent touches anything. Surfaces dirty working trees, recent
      // commits, and optional verification command results.
      const projectRoot = config.getProjectRoot?.() ?? config.getTargetDir();
      if (projectRoot) {
        runBaselineCheck(projectRoot)
          .then((result) => {
            const formatted = formatBaseline(result);
            historyManager.addItem(
              { type: MessageType.INFO, text: formatted },
              Date.now(),
            );
            if (result.isDirty) {
              historyManager.addItem(
                {
                  type: MessageType.WARNING,
                  text: `Working tree has ${result.dirtyFiles.length} uncommitted change(s). The agent may build on top of unstaged work.`,
                },
                Date.now(),
              );
            }
          })
          .catch(() => {
            // Not a git repo or git not available — skip silently
          });
      }

      const resumedSessionData = config.getResumedSessionData();
      if (resumedSessionData) {
        const historyItems = buildResumedHistoryItems(
          resumedSessionData,
          config,
        );
        historyManager.loadHistory(historyItems);
      }

      // Fire SessionStart event after config is initialized
      const sessionStartSource = resumedSessionData
        ? SessionStartSource.Resume
        : SessionStartSource.Startup;

      const hookSystem = config.getHookSystem();

      if (hookSystem) {
        hookSystem
          .fireSessionStartEvent(
            sessionStartSource,
            config.getModel() ?? '',
            String(config.getApprovalMode()) as PermissionMode,
          )
          .then(() => {
            debugLogger.debug('SessionStart event completed successfully');
          })
          .catch((err) => {
            debugLogger.warn(`SessionStart hook failed: ${err}`);
          });
      } else {
        debugLogger.debug(
          'SessionStart: HookSystem not available, skipping event',
        );
      }
    })();

    // Register SessionEnd cleanup for process exit
    registerCleanup(async () => {
      try {
        await config
          .getHookSystem()
          ?.fireSessionEndEvent(SessionEndReason.PromptInputExit);
        debugLogger.debug('SessionEnd event completed successfully!!!');
      } catch (err) {
        debugLogger.error(`SessionEnd hook failed: ${err}`);
      }
    });

    registerCleanup(async () => {
      const ideClient = await IdeClient.getInstance();
      await ideClient.disconnect();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
}
