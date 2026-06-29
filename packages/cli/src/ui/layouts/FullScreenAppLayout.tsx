/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, measureElement, type DOMElement } from 'ink';
import { HistoryItemDisplay } from '../components/HistoryItemDisplay.js';
import { AppHeader } from '../components/AppHeader.js';
import { Notifications } from '../components/Notifications.js';
import { DebugModeNotification } from '../components/DebugModeNotification.js';
import { useAppContext } from '../contexts/AppContext.js';
import { theme } from '../semantic-colors.js';
import { windowHistory } from '../utils/windowHistory.js';
import { DialogManager } from '../components/DialogManager.js';
import { Composer } from '../components/Composer.js';
import { ExitWarning } from '../components/ExitWarning.js';
import { BtwMessage } from '../components/messages/BtwMessage.js';
import { AgentTabBar } from '../components/agent-view/AgentTabBar.js';
import { AgentChatView } from '../components/agent-view/AgentChatView.js';
import { AgentComposer } from '../components/agent-view/AgentComposer.js';
import { StatusBar } from '../components/StatusBar.js';
import {
  TranscriptOverlay,
  clampScroll,
} from '../components/TranscriptOverlay.js';
import { OverflowProvider } from '../contexts/OverflowContext.js';
import { StreamingState } from '../types.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useAgentViewState } from '../contexts/AgentViewContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeypress, type Key } from '../hooks/useKeypress.js';

/**
 * Most recent history items the full-screen transcript renders at once. Older
 * items stay reachable via the Ctrl+O transcript pager. Sized to comfortably
 * cover several screens of scroll-back while bounding the per-frame layout cost.
 */
const MAX_WINDOW_ITEMS = 80;

/**
 * The scrolling transcript region for full-screen mode. Unlike the inline
 * `MainContent`, this does NOT use Ink's `<Static>` (the alternate screen has no
 * native scrollback to commit into) — it renders the history + pending items
 * into a `flexGrow` `overflow="hidden"` viewport whose inner content is shifted
 * by `marginTop={-scrollOffset}`, the same line-accurate technique the Ctrl+O
 * `TranscriptOverlay` already uses.
 *
 * Auto-follow: the view stays pinned to the bottom while new content streams in.
 * PgUp releases the pin so you can read back; PgDn to the bottom re-engages it.
 *
 * NOTE: renders only the recent window (MAX_WINDOW_ITEMS) and re-measures it on
 * each commit. Full measure-then-slice height-aware virtualization (for the
 * pathological huge-item case) is the deferred F1.5 follow-up.
 */
const FullScreenTranscript: React.FC = () => {
  const uiState = useUIState();
  const { version } = useAppContext();
  const { columns: terminalWidth } = useTerminalSize();

  const viewportRef = useRef<DOMElement | null>(null);
  const innerRef = useRef<DOMElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [following, setFollowing] = useState(true);

  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const maxScrollRef = useRef(maxScroll);
  maxScrollRef.current = maxScroll;
  const followingRef = useRef(following);
  followingRef.current = following;

  // Render only the recent window so long sessions don't re-lay-out the whole
  // history every frame (older items live in the Ctrl+O transcript). Memoized
  // so scrolling / streaming never re-renders the message list (only `marginTop`
  // and pending move). The slice is computed INSIDE the memo so its identity is
  // stable across renders.
  const { renderedHistory, olderCount } = useMemo(() => {
    const { windowed, olderCount: trimmed } = windowHistory(
      uiState.history,
      MAX_WINDOW_ITEMS,
    );
    return {
      olderCount: trimmed,
      renderedHistory: windowed.map((item) => (
        <HistoryItemDisplay
          key={item.id}
          item={item}
          isPending={false}
          isFocused={false}
          terminalWidth={terminalWidth}
          mainAreaWidth={uiState.mainAreaWidth}
          availableTerminalHeight={undefined}
          availableTerminalHeightGemini={undefined}
        />
      )),
    };
  }, [uiState.history, terminalWidth, uiState.mainAreaWidth]);

  const pending = uiState.pendingHistoryItems.map((item, i) => (
    <HistoryItemDisplay
      key={`pending-${i}`}
      item={{ ...item, id: 0 }}
      isPending={true}
      isFocused={!uiState.isEditorDialogOpen}
      terminalWidth={terminalWidth}
      mainAreaWidth={uiState.mainAreaWidth}
      availableTerminalHeight={undefined}
      activeShellPtyId={uiState.activePtyId}
      embeddedShellFocused={uiState.embeddedShellFocused}
    />
  ));

  // Measure viewport + content after layout. Re-runs when the rendered content
  // or width changes (incl. each streaming tick via pendingHistoryItems).
  // Guarded so equal heights don't trigger another render (no measure→setState
  // loop).
  useEffect(() => {
    if (viewportRef.current) {
      const h = measureElement(viewportRef.current).height;
      setViewportHeight((prev) => (prev === h ? prev : h));
    }
    if (innerRef.current) {
      const h = measureElement(innerRef.current).height;
      setContentHeight((prev) => (prev === h ? prev : h));
    }
  }, [renderedHistory, uiState.pendingHistoryItems, terminalWidth]);

  // Keep the offset pinned to the bottom while following; otherwise just clamp.
  useEffect(() => {
    setScrollOffset((prev) =>
      followingRef.current ? maxScroll : clampScroll(prev, maxScroll),
    );
  }, [maxScroll, contentHeight]);

  // Re-anchor to the bottom when the user submits a new prompt (history grows
  // with a user item) — even if they had scrolled up to read back.
  const prevHistoryLenRef = useRef(uiState.history.length);
  useEffect(() => {
    const len = uiState.history.length;
    if (len > prevHistoryLenRef.current) {
      const last = uiState.history[len - 1];
      if (last?.type === 'user') setFollowing(true);
    }
    prevHistoryLenRef.current = len;
  }, [uiState.history]);

  const pageStep = Math.max(1, viewportHeight - 1);
  const handleKeypress = useCallback(
    (key: Key) => {
      const max = maxScrollRef.current;
      if (key.name === 'pageup') {
        setFollowing(false);
        setScrollOffset((p) => clampScroll(p - pageStep, max));
      } else if (key.name === 'pagedown') {
        setScrollOffset((p) => {
          const next = clampScroll(p + pageStep, max);
          if (next >= max) setFollowing(true);
          return next;
        });
      }
    },
    [pageStep],
  );
  // Don't claim scroll keys while a dialog owns the input.
  useKeypress(handleKeypress, { isActive: !uiState.dialogsVisible });

  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0}>
      <Box
        ref={viewportRef}
        // flexBasis={0} is load-bearing: without it the box sizes to its
        // CONTENT (Yoga's default flexBasis is auto), so a tall/growing
        // transcript overflows and shoves the pinned composer + status bar
        // around every frame. With basis 0 + grow it fills exactly the
        // remaining space and `overflow="hidden"` clips the content cleanly.
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        flexDirection="column"
        overflow="hidden"
      >
        <OverflowProvider>
          <Box
            ref={innerRef}
            flexDirection="column"
            flexShrink={0}
            marginTop={-scrollOffset}
          >
            {/* Banner + info box: the start-of-session header (inline renders
                this as the first <Static> item). paddingTop gives it breathing
                room from the top edge of the alt-screen — inline gets that for
                free from the shell prompt above it, but full-screen starts at
                row 0. It scrolls away with the banner as the conversation grows,
                and reappears when you PgUp to the top. */}
            <Box flexDirection="column" paddingTop={1}>
              <AppHeader version={version} />
              <DebugModeNotification />
              <Notifications />
            </Box>
            {olderCount > 0 && (
              <Text color={theme.text.secondary}>
                ↑ {olderCount} earlier{' '}
                {olderCount === 1 ? 'message' : 'messages'} — press Ctrl+O for
                the full transcript
              </Text>
            )}
            {renderedHistory}
            {pending}
          </Box>
        </OverflowProvider>
      </Box>
      {/* Auto-follow cue: shown only while scrolled away from the bottom, so the
          scroll model is discoverable without permanently eating a line. */}
      {!following && maxScroll > 0 && (
        <Box paddingX={1}>
          <Text color={theme.text.accent}>↓ </Text>
          <Text color={theme.text.secondary}>
            more below · PgDn to catch up
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Full-screen layout: a dedicated scrolling transcript region that fills the
 * alternate screen, with the composer / dialogs and status bar pinned at the
 * bottom. Selected by `App` when `ui.fullScreen` (or `PROTO_FULLSCREEN=1`) is
 * on; screen-reader mode always wins over this for accessibility.
 */
export const FullScreenAppLayout: React.FC = () => {
  const uiState = useUIState();
  const { closeTranscript } = useUIActions();
  const { activeView, agents } = useAgentViewState();
  const { columns: terminalWidth, rows: terminalHeight } = useTerminalSize();
  const config = useConfig();
  const hasAgents = agents.size > 0;
  const isAgentTab = activeView !== 'main' && agents.has(activeView);

  // Full-screen does not capture the mouse, so text selection + copy are the
  // terminal's own (native) — nothing for proto to render. Scroll is PgUp/PgDn
  // (see FullScreenTranscript). See useFullScreen for the rationale.

  if (uiState.isTranscriptOpen) {
    return <TranscriptOverlay onClose={closeTranscript} />;
  }

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {isAgentTab ? (
        <>
          <Box
            flexGrow={1}
            flexShrink={1}
            flexBasis={0}
            flexDirection="column"
            overflow="hidden"
          >
            <AgentChatView agentId={activeView} />
          </Box>
          <Box flexDirection="column" ref={uiState.mainControlsRef}>
            <AgentComposer key={activeView} agentId={activeView} />
            <ExitWarning />
          </Box>
        </>
      ) : (
        <>
          <FullScreenTranscript />
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

      {hasAgents && !uiState.dialogsVisible && <AgentTabBar />}

      <StatusBar
        cwd={config.getTargetDir()}
        terminalWidth={terminalWidth}
        bgSessionActive={uiState.streamingState === StreamingState.Backgrounded}
      />
    </Box>
  );
};
