/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  useBackgroundAgentProgress,
  type ActiveAgentState,
} from '../hooks/useBackgroundAgentProgress.js';

/**
 * The current activity of a background agent: its name and either the tool it's
 * running or which turn it's on.
 */
function agentActivity(agent: ActiveAgentState): {
  icon: string;
  name: string;
  activity: string;
} {
  return {
    icon: '⟳',
    name: agent.agentName,
    activity: agent.toolName ? agent.toolName : `turn ${agent.round}`,
  };
}

/**
 * A small panel of cards for the currently-running background agents — one
 * readable line each instead of badges crammed into the status bar. Renders
 * nothing when no agent is active, so it costs no space at rest. The underlying
 * progress feed (`useBackgroundAgentProgress`) is self-contained, so this can be
 * dropped in wherever the layout wants the live activity to surface.
 *
 * The `session-memory` note-writer is excluded: it fires every turn as routine
 * housekeeping, so surfacing it ("↺ notes: writing") is just noise.
 */
export const BackgroundAgentsPanel: React.FC = () => {
  const { activeAgents } = useBackgroundAgentProgress();
  const agents = activeAgents.filter(
    (agent) => agent.agentName !== 'session-memory',
  );
  if (agents.length === 0) return null;

  return (
    <Box flexDirection="column" paddingX={1}>
      {agents.map((agent) => {
        const { icon, name, activity } = agentActivity(agent);
        return (
          <Box key={agent.agentId} flexDirection="row">
            <Text color={theme.status.warning}>{icon} </Text>
            <Text color={theme.text.primary} bold>
              {name}
            </Text>
            <Text color={theme.text.secondary}>: {activity}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
