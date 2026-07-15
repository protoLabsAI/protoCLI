/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Box } from 'ink';
import { MainContent } from '../components/MainContent.js';
import { DialogManager } from '../components/DialogManager.js';
import { Composer } from '../components/Composer.js';
import { ExitWarning } from '../components/ExitWarning.js';
import { BtwMessage } from '../components/messages/BtwMessage.js';
import { AgentTabBar } from '../components/agent-view/AgentTabBar.js';
import { AgentChatView } from '../components/agent-view/AgentChatView.js';
import { AgentComposer } from '../components/agent-view/AgentComposer.js';
import { StatusBar } from '../components/StatusBar.js';
import { BackgroundAgentsPanel } from '../components/BackgroundAgentsPanel.js';
import { TranscriptOverlay } from '../components/TranscriptOverlay.js';
import { StreamingState } from '../types.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useAgentViewState } from '../contexts/AgentViewContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

/**
 * Max repaint cadence while the terminal is being resized. Small enough that a
 * drag never accumulates more than a frame or two of stale output before it's
 * cleared, large enough not to clear+reprint on every single resize event.
 */
const RESIZE_THROTTLE_MS = 80;

export const DefaultAppLayout: React.FC = () => {
  const uiState = useUIState();
  const { refreshStatic, closeTranscript } = useUIActions();
  const { activeView, agents } = useAgentViewState();
  const { columns: terminalWidth } = useTerminalSize();
  const config = useConfig();
  const hasAgents = agents.size > 0;
  const isAgentTab = activeView !== 'main' && agents.has(activeView);

  // Clear terminal on view switch so previous view's <Static> output
  // is removed. refreshStatic clears the terminal and bumps the
  // historyRemountKey so MainContent's <Static> re-renders all items
  // when switching back.
  const prevViewRef = useRef(activeView);
  useEffect(() => {
    if (prevViewRef.current !== activeView) {
      prevViewRef.current = activeView;
      refreshStatic();
    }
  }, [activeView, refreshStatic]);

  // Opening/closing the transcript overlay swaps the whole main view in and
  // out. Clear the terminal on each transition so the overlay starts on a
  // clean screen and the scrollback reprints intact once it closes (mirrors
  // the agent-view switch above).
  const isTranscriptOpen = uiState.isTranscriptOpen;
  const prevTranscriptRef = useRef(isTranscriptOpen);
  useEffect(() => {
    if (prevTranscriptRef.current !== isTranscriptOpen) {
      prevTranscriptRef.current = isTranscriptOpen;
      refreshStatic();
    }
  }, [isTranscriptOpen, refreshStatic]);

  // Clear + reprint the whole frame on terminal resize.
  //
  // Two things break on resize, both fixed by refreshStatic() (clear the
  // screen + remount <Static> so history and the live region reprint cleanly
  // at the new size):
  //   1. <Static> history is append-only and index-tracked — it never redraws
  //      already-committed lines, so the terminal re-wraps them into garbage.
  //   2. Ink's live region (composer, sticky task list, status bar) is redrawn
  //      by erasing the previous frame's *stored* line count. After a resize
  //      the terminal has reflowed that frame to a different height, so the
  //      erase misses lines and the stale frame is pushed into scrollback —
  //      one duplicate per resize event, i.e. an avalanche during a drag.
  //
  // Throttled (leading + trailing), NOT debounced: a continuous drag emits
  // resize events faster than it ever settles, so a trailing-only debounce
  // would let the avalanche build until the drag stops. The throttle repaints
  // at a bounded cadence *during* the drag and once more when it settles.
  // Listens on stdout directly (not via useTerminalSize state) so the handler
  // runs synchronously on the event and is immune to React batching.
  useEffect(() => {
    let lastRun = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    let lastCols = process.stdout.columns;
    let lastRows = process.stdout.rows;

    const fire = () => {
      lastRun = Date.now();
      refreshStatic();
    };

    const onResize = () => {
      const cols = process.stdout.columns;
      const rows = process.stdout.rows;
      // Some terminals emit 'resize' for non-size events; ignore no-ops.
      if (cols === lastCols && rows === lastRows) {
        return;
      }
      lastCols = cols;
      lastRows = rows;

      const sinceLast = Date.now() - lastRun;
      if (sinceLast >= RESIZE_THROTTLE_MS) {
        if (trailing) {
          clearTimeout(trailing);
          trailing = undefined;
        }
        fire(); // leading edge — repaint immediately
      } else if (!trailing) {
        // Coalesce the rest of this burst into one repaint at the throttle
        // boundary; keep the pending timer rather than resetting it so a
        // sustained drag still repaints every RESIZE_THROTTLE_MS.
        trailing = setTimeout(() => {
          trailing = undefined;
          fire();
        }, RESIZE_THROTTLE_MS - sinceLast);
      }
    };

    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
      if (trailing) {
        clearTimeout(trailing);
      }
    };
  }, [refreshStatic]);

  if (isTranscriptOpen) {
    return <TranscriptOverlay onClose={closeTranscript} />;
  }

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {isAgentTab ? (
        <>
          {/* Agent view: chat history + agent-specific composer */}
          <AgentChatView agentId={activeView} />
          <Box flexDirection="column" ref={uiState.mainControlsRef}>
            <AgentComposer key={activeView} agentId={activeView} />
            <ExitWarning />
          </Box>
        </>
      ) : (
        <>
          {/* Main view: conversation history + main composer / dialogs */}
          <MainContent />
          <Box flexDirection="column" ref={uiState.mainControlsRef}>
            {uiState.dialogsVisible ? (
              <Box
                marginX={2}
                flexDirection="column"
                width={uiState.mainAreaWidth}
              >
                <DialogManager
                  terminalWidth={uiState.terminalWidth}
                  addItem={uiState.historyManager.addItem}
                />
              </Box>
            ) : uiState.btwItem ? (
              <Box marginX={2} width={terminalWidth - 4}>
                <BtwMessage btw={uiState.btwItem.btw} />
              </Box>
            ) : (
              <Composer />
            )}
            <ExitWarning />
          </Box>
        </>
      )}

      {/* Tab bar: visible whenever in-process agents exist and input is active */}
      {hasAgents && !uiState.dialogsVisible && <AgentTabBar />}

      {/* Live background-agent activity, as cards above the status bar */}
      <BackgroundAgentsPanel />

      {/* Status bar: CWD · git branch · uncommitted diff */}
      <StatusBar
        cwd={config.getTargetDir()}
        terminalWidth={terminalWidth}
        bgSessionActive={uiState.streamingState === StreamingState.Backgrounded}
      />
    </Box>
  );
};
