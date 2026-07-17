/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box } from 'ink';
import type { StatusToken } from './types.js';

interface TokenBarProps {
  /** Ordered, already-filtered tokens. Build with `tokens(...)`. */
  tokens: StatusToken[];
  /** Drawn between adjacent tokens — never before the first or after the last. */
  separator: React.ReactNode;
}

/**
 * Renders an ordered token array, interleaving `separator` between cells.
 *
 * The separator is placed by position within the *rendered* array, so a token
 * that was filtered out upstream cannot leave a dangling separator behind.
 */
export const TokenBar: React.FC<TokenBarProps> = ({
  tokens: items,
  separator,
}) => (
  <>
    {items.map((token, index) => (
      <Box key={token.key} alignItems="center">
        {index > 0 && separator}
        {token.node}
      </Box>
    ))}
  </>
);
