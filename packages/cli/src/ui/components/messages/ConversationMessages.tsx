/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';
import { theme } from '../../semantic-colors.js';
import {
  SCREEN_READER_MODEL_PREFIX,
  SCREEN_READER_USER_PREFIX,
} from '../../textConstants.js';

interface UserMessageProps {
  text: string;
}

interface UserShellMessageProps {
  text: string;
}

interface AssistantMessageProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
}

interface AssistantMessageContentProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
}

interface ThinkMessageProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
}

interface ThinkMessageContentProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
}

interface PrefixedTextMessageProps {
  text: string;
  prefix: string;
  prefixColor: string;
  textColor: string;
  ariaLabel?: string;
  marginTop?: number;
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end';
}

interface PrefixedMarkdownMessageProps {
  text: string;
  prefix: string;
  prefixColor: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
  ariaLabel?: string;
  textColor?: string;
}

interface ContinuationMarkdownMessageProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  contentWidth: number;
  basePrefix: string;
  textColor?: string;
}

function getPrefixWidth(prefix: string): number {
  // Reserve one extra column so text never touches the prefix glyph.
  return stringWidth(prefix) + 1;
}

const PrefixedTextMessage: React.FC<PrefixedTextMessageProps> = ({
  text,
  prefix,
  prefixColor,
  textColor,
  ariaLabel,
  marginTop = 0,
  alignSelf,
}) => {
  const prefixWidth = getPrefixWidth(prefix);

  return (
    <Box
      flexDirection="row"
      paddingY={0}
      marginTop={marginTop}
      alignSelf={alignSelf}
    >
      <Box width={prefixWidth}>
        <Text color={prefixColor} aria-label={ariaLabel}>
          {prefix}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="wrap" color={textColor}>
          {text}
        </Text>
      </Box>
    </Box>
  );
};

const PrefixedMarkdownMessage: React.FC<PrefixedMarkdownMessageProps> = ({
  text,
  prefix,
  prefixColor,
  isPending,
  availableTerminalHeight,
  contentWidth,
  ariaLabel,
  textColor,
}) => {
  const prefixWidth = getPrefixWidth(prefix);

  return (
    <Box flexDirection="row">
      <Box width={prefixWidth}>
        <Text color={prefixColor} aria-label={ariaLabel}>
          {prefix}
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <MarkdownDisplay
          text={text}
          isPending={isPending}
          availableTerminalHeight={availableTerminalHeight}
          contentWidth={contentWidth - prefixWidth}
          textColor={textColor}
        />
      </Box>
    </Box>
  );
};

const ContinuationMarkdownMessage: React.FC<
  ContinuationMarkdownMessageProps
> = ({
  text,
  isPending,
  availableTerminalHeight,
  contentWidth,
  basePrefix,
  textColor,
}) => {
  const prefixWidth = getPrefixWidth(basePrefix);

  return (
    <Box flexDirection="column" paddingLeft={prefixWidth}>
      <MarkdownDisplay
        text={text}
        isPending={isPending}
        availableTerminalHeight={availableTerminalHeight}
        contentWidth={contentWidth - prefixWidth}
        textColor={textColor}
      />
    </Box>
  );
};

export const UserMessage: React.FC<UserMessageProps> = ({ text }) => (
  <PrefixedTextMessage
    text={text}
    prefix=">"
    prefixColor={theme.text.accent}
    textColor={theme.text.accent}
    ariaLabel={SCREEN_READER_USER_PREFIX}
    alignSelf="flex-start"
  />
);

export const UserShellMessage: React.FC<UserShellMessageProps> = ({ text }) => {
  const commandToDisplay = text.startsWith('!') ? text.substring(1) : text;

  return (
    <PrefixedTextMessage
      text={commandToDisplay}
      prefix="$"
      prefixColor={theme.text.link}
      textColor={theme.text.primary}
    />
  );
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  contentWidth,
}) => {
  // A turn that only calls tools (no prose) yields an empty assistant message.
  // Rendering it would print a lone "⟡" on its own line above the tool group,
  // so suppress it entirely when there's no text.
  if (!text || text.trim() === '') {
    return null;
  }
  return (
    <PrefixedMarkdownMessage
      text={text}
      prefix="⟡"
      prefixColor={theme.text.accent}
      ariaLabel={SCREEN_READER_MODEL_PREFIX}
      isPending={isPending}
      availableTerminalHeight={availableTerminalHeight}
      contentWidth={contentWidth}
    />
  );
};

export const AssistantMessageContent: React.FC<
  AssistantMessageContentProps
> = ({ text, isPending, availableTerminalHeight, contentWidth }) => {
  if (!text || text.trim() === '') {
    return null;
  }
  return (
    <ContinuationMarkdownMessage
      text={text}
      isPending={isPending}
      availableTerminalHeight={availableTerminalHeight}
      contentWidth={contentWidth}
      basePrefix="⟡"
    />
  );
};

// Post-stream summary line ("▸ thinking (N chars)"). Phase 1 of the reasoning
// rendering work (see #162): full text remains live in Langfuse, ACP
// `agent_thought_chunk` notifications, and ChatRecord for back-compat. An
// in-TUI expand affordance is a follow-up. Note: when a long thought was
// split mid-stream into a gemini_thought + gemini_thought_content pair, this
// counts only the first chunk — the continuation renders nothing (see below).
// True total requires post-finalize coalescing in useGeminiStream and is
// deferred since splits are rare and the count is a hint, not a contract.
const ThinkSummary: React.FC<{ text: string }> = ({ text }) => {
  const charCount = text.length;
  return (
    <PrefixedTextMessage
      text={`thinking (${charCount.toLocaleString()} chars)`}
      prefix="▸"
      prefixColor={theme.text.secondary}
      textColor={theme.text.secondary}
    />
  );
};

export const ThinkMessage: React.FC<ThinkMessageProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  contentWidth,
}) => {
  // An empty thought (e.g. a thought/continuation split boundary) would render
  // either a lone "⟡" while streaming or "▸ thinking (0 chars)" once finalized.
  // Neither is useful, so suppress it.
  if (!text || text.trim() === '') {
    return null;
  }
  if (!isPending) {
    return <ThinkSummary text={text} />;
  }
  return (
    <PrefixedMarkdownMessage
      text={text}
      prefix="⟡"
      prefixColor={theme.text.secondary}
      isPending={isPending}
      availableTerminalHeight={availableTerminalHeight}
      contentWidth={contentWidth}
      textColor={theme.text.secondary}
    />
  );
};

export const ThinkMessageContent: React.FC<ThinkMessageContentProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  contentWidth,
}) => {
  // When the stream has finalized, suppress the continuation block. The
  // adjacent ThinkMessage already renders the summary line; rendering this
  // continuation as another summary would double-count and drop chars across
  // the split boundary. Streaming-time renders unchanged so live thoughts
  // still appear.
  if (!isPending) {
    return null;
  }
  return (
    <ContinuationMarkdownMessage
      text={text}
      isPending={isPending}
      availableTerminalHeight={availableTerminalHeight}
      contentWidth={contentWidth}
      basePrefix="⟡"
      textColor={theme.text.secondary}
    />
  );
};
