/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import os from 'node:os';
import { useGitBranchName } from '../hooks/useGitBranchName.js';
import { useGitDiffStat } from '../hooks/useGitDiffStat.js';
import { theme } from '../semantic-colors.js';
import { TokenBar } from './status/TokenBar.js';
import { tokens } from './status/types.js';

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  /** Dim the badge text (for secondary info). */
  dim?: boolean;
  /** Override text color. */
  color?: string;
}

const Badge = ({ children, dim, color }: BadgeProps) => (
  <Box paddingX={1}>
    <Text
      color={color ?? (dim ? theme.text.secondary : theme.text.primary)}
      dimColor={dim}
    >
      {children}
    </Text>
  </Box>
);

// ─── Separator ────────────────────────────────────────────────────────────────

const Sep = () => <Text color={theme.border.default}> │ </Text>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collapse $HOME to ~ in a path string. */
function tildify(p: string): string {
  const home = os.homedir();
  if (p === home) return '~';
  const homePrefix = home.endsWith(path.sep) ? home : `${home}${path.sep}`;
  return p.startsWith(homePrefix) ? `~${p.slice(home.length)}` : p;
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

interface StatusBarProps {
  cwd: string;
  terminalWidth: number;
  bgSessionActive?: boolean;
}

/**
 * Sticky bottom status bar showing:
 *   ⟡  [N files • +added −removed]  ~/path/to/cwd  ⎇ branch
 *
 * All info is read-only; the diff stat polls git every 5 s.
 */
export const StatusBar = ({
  cwd,
  terminalWidth,
  bgSessionActive,
}: StatusBarProps) => {
  const branch = useGitBranchName(cwd);
  const diff = useGitDiffStat(cwd);

  const cwdDisplay = tildify(path.resolve(cwd));

  // Only render the diff badge when there are actual changes.
  const hasDiff = diff !== null && diff.filesChanged > 0;

  // Ordered token array — <TokenBar /> owns the ⟡-to-branch separator chain.
  // Active background agents render as cards in BackgroundAgentsPanel (above
  // the status bar), not as badges crammed in here.
  const barTokens = tokens(
    {
      key: 'logo',
      node: (
        <Text color={theme.text.accent} bold>
          ⟡
        </Text>
      ),
    },
    {
      key: 'hostname',
      node: (
        <Badge dim>
          <Text>⬡ </Text>
          <Text>{os.hostname()}</Text>
        </Badge>
      ),
    },
    bgSessionActive && {
      key: 'bg-session',
      node: (
        <Badge>
          <Text color={theme.text.secondary}>⟳ bg session</Text>
        </Badge>
      ),
    },
    hasDiff && {
      key: 'diff',
      node: (
        <Badge>
          <Text color={theme.text.secondary}>
            {diff.filesChanged} file{diff.filesChanged !== 1 ? 's' : ''}
          </Text>
          {diff.linesAdded > 0 && (
            <Text color={theme.status.success}> +{diff.linesAdded}</Text>
          )}
          {diff.linesRemoved > 0 && (
            <Text color={theme.status.error}> −{diff.linesRemoved}</Text>
          )}
        </Badge>
      ),
    },
    {
      key: 'cwd',
      node: (
        <Badge dim>
          <Text>⌂ </Text>
          <Text>{cwdDisplay}</Text>
        </Badge>
      ),
    },
    branch && {
      key: 'branch',
      node: (
        <Badge>
          <Text color={theme.text.secondary}>⎇ </Text>
          <Text color={theme.text.primary}>{branch}</Text>
        </Badge>
      ),
    },
  );

  return (
    <Box
      width={terminalWidth}
      flexDirection="row"
      alignItems="center"
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={theme.border.default}
      paddingX={1}
    >
      <TokenBar tokens={barTokens} separator={<Sep />} />
    </Box>
  );
};
