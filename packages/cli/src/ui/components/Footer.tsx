/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ContextUsageDisplay } from './ContextUsageDisplay.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { AutoAcceptIndicator } from './AutoAcceptIndicator.js';
import { ShellModeIndicator } from './ShellModeIndicator.js';
import { MCPHealthPill } from './mcp/MCPHealthPill.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';

import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useVimMode } from '../contexts/VimModeContext.js';
import { ApprovalMode } from '@qwen-code/qwen-code-core';
import { t } from '../../i18n/index.js';
import { VoiceMicButton } from './VoiceMicButton.js';
import { GoalPill } from './GoalPill.js';
import { useGoalStatus } from '../hooks/useGoalStatus.js';
import { TokenBar } from './status/TokenBar.js';
import { firstToken, tokens } from './status/types.js';

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const { vimEnabled, vimMode } = useVimMode();

  const { promptTokenCount, showAutoAcceptIndicator } = {
    promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
    showAutoAcceptIndicator: uiState.showAutoAcceptIndicator,
  };

  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  // Determine sandbox info from environment
  const sandboxEnv = process.env['SANDBOX'];
  const sandboxInfo = sandboxEnv
    ? sandboxEnv === 'sandbox-exec'
      ? 'seatbelt'
      : sandboxEnv.startsWith('qwen-code')
        ? 'docker'
        : sandboxEnv
    : null;

  // Check if debug mode is enabled
  const debugMode = config.getDebugMode();

  const contextWindowSize =
    config.getContentGeneratorConfig()?.contextWindowSize;

  const goalStatus = useGoalStatus(config);

  // Left slot shows exactly ONE thing: the first applicable token wins, so the
  // order of this list IS the priority order.
  const leftToken = firstToken(
    uiState.voiceState === 'recording' && {
      key: 'voice-recording',
      node: (
        <Text color={theme.status.error}>
          ● Recording… (ctrl+space to stop)
        </Text>
      ),
    },
    uiState.voiceState === 'transcribing' && {
      key: 'voice-transcribing',
      node: <Text dimColor>◌ Transcribing…</Text>,
    },
    uiState.ctrlCPressedOnce && {
      key: 'ctrl-c',
      node: (
        <Text color={theme.status.warning}>
          {t('Press Ctrl+C again to exit.')}
        </Text>
      ),
    },
    uiState.ctrlDPressedOnce && {
      key: 'ctrl-d',
      node: (
        <Text color={theme.status.warning}>
          {t('Press Ctrl+D again to exit.')}
        </Text>
      ),
    },
    uiState.showEscapePrompt && {
      key: 'escape-prompt',
      node: (
        <Text color={theme.text.secondary}>
          {t('Press Esc again to clear.')}
        </Text>
      ),
    },
    vimEnabled &&
      vimMode === 'INSERT' && {
        key: 'vim-insert',
        node: <Text color={theme.text.secondary}>-- INSERT --</Text>,
      },
    uiState.shellModeActive && {
      key: 'shell-mode',
      node: <ShellModeIndicator />,
    },
    showAutoAcceptIndicator !== undefined &&
      showAutoAcceptIndicator !== ApprovalMode.DEFAULT && {
        key: 'approval-mode',
        node: <AutoAcceptIndicator approvalMode={showAutoAcceptIndicator} />,
      },
    {
      // Default mode: the autonomy chip stays visible (so the current mode is
      // always shown) next to the shortcut hints.
      key: 'default-hint',
      node: (
        <Box>
          <AutoAcceptIndicator approvalMode={ApprovalMode.DEFAULT} />
          <Text color={theme.text.secondary}>
            {'  ·  '}
            {t('? for shortcuts')}
            {'  ·  '}
            {t('Esc×2: rewind')}
          </Text>
        </Box>
      ),
    },
  );

  const rightTokens = tokens(
    { key: 'voice', node: <VoiceMicButton /> },
    sandboxInfo && {
      key: 'sandbox',
      node: <Text color={theme.status.success}>🔒 {sandboxInfo}</Text>,
    },
    debugMode && {
      key: 'debug',
      node: <Text color={theme.status.warning}>Debug Mode</Text>,
    },
    promptTokenCount > 0 &&
      Boolean(contextWindowSize) && {
        key: 'context',
        node: (
          <Text color={theme.text.accent}>
            <ContextUsageDisplay
              promptTokenCount={promptTokenCount}
              terminalWidth={terminalWidth}
              contextWindowSize={contextWindowSize as number}
            />
          </Text>
        ),
      },
    goalStatus && {
      // Active /goal indicator -- last so it lands rightmost (most visible) in
      // the footer. Mirrors Codex CLI's status-line goal slot.
      key: 'goal',
      node: <GoalPill snapshot={goalStatus} />,
    },
  );

  return (
    <Box
      justifyContent="space-between"
      width="100%"
      flexDirection="row"
      alignItems="center"
    >
      {/* Left Section: Exactly one status line (exit prompts / mode indicator / default hint) */}
      <Box
        marginLeft={2}
        justifyContent="flex-start"
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
      >
        {leftToken?.node}
        <MCPHealthPill />
      </Box>

      {/* Right Section: an ordered token array — voice · sandbox · debug · context · goal */}
      <Box alignItems="center" justifyContent="flex-end" marginRight={2}>
        <TokenBar
          tokens={rightTokens}
          separator={<Text color={theme.text.secondary}> | </Text>}
        />
      </Box>
    </Box>
  );
};
