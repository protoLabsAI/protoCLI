/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type {
  AnsiLine,
  AnsiOutput,
  AnsiToken,
} from '@qwen-code/qwen-code-core';
import { theme } from '../semantic-colors.js';

const DEFAULT_HEIGHT = 24;

interface AnsiOutputProps {
  data: AnsiOutput;
  availableTerminalHeight?: number;
}

export const AnsiOutputText: React.FC<AnsiOutputProps> = ({
  data,
  availableTerminalHeight,
}) => {
  const lastLines = data.slice(
    -(availableTerminalHeight && availableTerminalHeight > 0
      ? availableTerminalHeight
      : DEFAULT_HEIGHT),
  );
  return lastLines.map((line: AnsiLine, lineIndex: number) => (
    <Text key={lineIndex}>
      {line.length > 0
        ? line.map((token: AnsiToken, tokenIndex: number) => (
            <Text
              key={tokenIndex}
              color={token.inverse ? token.bg : token.fg}
              backgroundColor={token.inverse ? token.fg : token.bg}
              dimColor={token.dim}
              bold={token.bold}
              italic={token.italic}
              underline={token.underline}
            >
              {token.text}
            </Text>
          ))
        : null}
    </Text>
  ));
};

export interface ShellStatsBarProps {
  /** Total ANSI lines produced by the command, before any display cap. */
  totalLines?: number;
  /** Visible row count after capping. Used to compute `+N lines` overflow. */
  displayHeight?: number;
}

/**
 * One-line indicator rendered under capped shell ANSI output. Surfaces the
 * count of hidden rows (`+N lines`) so the user knows there's more output
 * than what's visible. Renders nothing when nothing is hidden.
 *
 * Adapted from upstream QwenLM/qwen-code's `AnsiOutput.tsx` ShellStatsBar
 * (introduced in #3155). Slimmed to just the line-count piece — upstream's
 * `totalBytes` (UTF-8 byte size) display is part of the broader
 * #3155 tool-execution-progress feature we haven't ported here.
 */
export const ShellStatsBar: React.FC<ShellStatsBarProps> = ({
  totalLines,
  displayHeight = DEFAULT_HEIGHT,
}) => {
  if (!totalLines || totalLines <= displayHeight) return null;
  const hidden = totalLines - displayHeight;
  return (
    <Box flexDirection="row">
      <Text color={theme.text.secondary}>{`+${hidden} lines`}</Text>
    </Box>
  );
};
