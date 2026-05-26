/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, measureElement, type DOMElement } from 'ink';
import { useKeypress, type Key } from '../hooks/useKeypress.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { HistoryItemDisplay } from './HistoryItemDisplay.js';
import { ThoughtExpansionContext } from './messages/ConversationMessages.js';
import { theme } from '../semantic-colors.js';

interface TranscriptOverlayProps {
  onClose: () => void;
}

/** Clamp a scroll offset into the valid `[0, max]` range. */
export function clampScroll(offset: number, max: number): number {
  return Math.max(0, Math.min(max, offset));
}

/**
 * Full-screen transcript view (opened with Ctrl+O). Renders the entire history
 * with thoughts expanded — the inverse of the compact scrollback, which
 * collapses thoughts to a "▸ thinking (N chars)" summary.
 *
 * Scrolling is line-accurate: the body is a fixed-height `overflow="hidden"`
 * viewport whose inner content is shifted up by `marginTop={-scrollOffset}`.
 * The inner content's true height is read with `measureElement` so we can clamp
 * the offset. This handles thoughts taller than the screen, which item-windowed
 * scrolling could not.
 */
export const TranscriptOverlay: React.FC<TranscriptOverlayProps> = ({
  onClose,
}) => {
  const uiState = useUIState();
  const { columns: terminalWidth, rows: terminalHeight } = useTerminalSize();

  // 1 header line + 1 footer line; the rest is the scrollable viewport.
  const viewportHeight = Math.max(1, terminalHeight - 2);
  const pageStep = Math.max(1, viewportHeight - 1);

  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const innerRef = useRef<DOMElement | null>(null);
  const initializedRef = useRef(false);

  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const maxScrollRef = useRef(maxScroll);
  maxScrollRef.current = maxScroll;

  // Render the history once per content change so scrolling (which only mutates
  // marginTop on the wrapper) never re-renders the message list.
  const renderedHistory = React.useMemo(
    () =>
      uiState.history.map((item) => (
        <HistoryItemDisplay
          key={item.id}
          item={item}
          isPending={false}
          isFocused={false}
          terminalWidth={terminalWidth}
          // No height caps: the overlay shows everything in full.
          availableTerminalHeight={undefined}
          availableTerminalHeightGemini={undefined}
        />
      )),
    [uiState.history, terminalWidth],
  );

  // Measure the rendered content after layout so we know how far it can scroll.
  useEffect(() => {
    if (!innerRef.current) return;
    const { height } = measureElement(innerRef.current);
    setContentHeight(height);
  }, [renderedHistory, viewportHeight, terminalWidth]);

  // Open anchored to the bottom (latest content) the first time we know the
  // real height; afterwards just keep the offset within bounds.
  useEffect(() => {
    if (!initializedRef.current && contentHeight > 0) {
      initializedRef.current = true;
      setScrollOffset(maxScroll);
      return;
    }
    setScrollOffset((prev) => clampScroll(prev, maxScroll));
  }, [contentHeight, maxScroll]);

  const handleKeypress = useCallback(
    (key: Key) => {
      const max = maxScrollRef.current;
      if (key.name === 'escape' || key.name === 'q') {
        onClose();
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        setScrollOffset((p) => clampScroll(p - 1, max));
      } else if (key.name === 'down' || key.name === 'j') {
        setScrollOffset((p) => clampScroll(p + 1, max));
      } else if (key.name === 'pageup') {
        setScrollOffset((p) => clampScroll(p - pageStep, max));
      } else if (key.name === 'pagedown' || key.sequence === ' ') {
        setScrollOffset((p) => clampScroll(p + pageStep, max));
      } else if (key.name === 'g') {
        setScrollOffset(0);
      } else if (key.name === 'G') {
        setScrollOffset(max);
      }
    },
    [onClose, pageStep],
  );
  useKeypress(handleKeypress, { isActive: true });

  const atBottom = scrollOffset >= maxScroll;
  const position =
    maxScroll === 0
      ? 'all'
      : atBottom
        ? 'bottom'
        : scrollOffset === 0
          ? 'top'
          : `${Math.round((scrollOffset / maxScroll) * 100)}%`;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      <Box width={terminalWidth}>
        <Text color={theme.text.accent} bold>
          {' '}
          Transcript{' '}
        </Text>
        <Text color={theme.text.secondary}>
          — thoughts expanded · {position}
        </Text>
      </Box>

      <Box
        height={viewportHeight}
        width={terminalWidth}
        flexDirection="column"
        overflow="hidden"
      >
        <Box
          ref={innerRef}
          flexDirection="column"
          flexShrink={0}
          marginTop={-scrollOffset}
        >
          <ThoughtExpansionContext.Provider value={true}>
            {renderedHistory}
          </ThoughtExpansionContext.Provider>
        </Box>
      </Box>

      <Box width={terminalWidth}>
        <Text color={theme.text.secondary}>
          {' '}
          ↑/↓ scroll · PgUp/PgDn · g/G top/bottom · Esc or q to close
        </Text>
      </Box>
    </Box>
  );
};
