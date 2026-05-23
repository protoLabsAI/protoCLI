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

  // Left section should show exactly ONE thing at any time, in priority order.
  const leftContent =
    uiState.voiceState === 'recording' ? (
      <Text color={theme.status.error}>● Recording… (ctrl+space to stop)</Text>
    ) : uiState.voiceState === 'transcribing' ? (
      <Text dimColor>◌ Transcribing…</Text>
    ) : uiState.ctrlCPressedOnce ? (
      <Text color={theme.status.warning}>
        {t('Press Ctrl+C again to exit.')}
      </Text>
    ) : uiState.ctrlDPressedOnce ? (
      <Text color={theme.status.warning}>
        {t('Press Ctrl+D again to exit.')}
      </Text>
    ) : uiState.showEscapePrompt ? (
      <Text color={theme.text.secondary}>{t('Press Esc again to clear.')}</Text>
    ) : vimEnabled && vimMode === 'INSERT' ? (
      <Text color={theme.text.secondary}>-- INSERT --</Text>
    ) : uiState.shellModeActive ? (
      <ShellModeIndicator />
    ) : showAutoAcceptIndicator !== undefined &&
      showAutoAcceptIndicator !== ApprovalMode.DEFAULT ? (
      <AutoAcceptIndicator approvalMode={showAutoAcceptIndicator} />
    ) : (
      <Text color={theme.text.secondary}>
        {t('? for shortcuts')}
        {'  ·  '}
        {t('Esc×2: rewind')}
      </Text>
    );

  const rightItems: Array<{ key: string; node: React.ReactNode }> = [
    { key: 'voice', node: <VoiceMicButton /> },
  ];
  if (sandboxInfo) {
    rightItems.push({
      key: 'sandbox',
      node: <Text color={theme.status.success}>🔒 {sandboxInfo}</Text>,
    });
  }
  if (debugMode) {
    rightItems.push({
      key: 'debug',
      node: <Text color={theme.status.warning}>Debug Mode</Text>,
    });
  }
  if (promptTokenCount > 0 && contextWindowSize) {
    rightItems.push({
      key: 'context',
      node: (
        <Text color={theme.text.accent}>
          <ContextUsageDisplay
            promptTokenCount={promptTokenCount}
            terminalWidth={terminalWidth}
            contextWindowSize={contextWindowSize}
          />
        </Text>
      ),
    });
  }
  if (goalStatus) {
    // Active /goal indicator -- pushed last so it lands rightmost (most
    // visible) in the footer. Mirrors Codex CLI's status-line goal slot.
    rightItems.push({
      key: 'goal',
      node: <GoalPill snapshot={goalStatus} />,
    });
  }
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
        {leftContent}
        <MCPHealthPill />
      </Box>

      {/* Right Section: Sandbox Info, Debug Mode, Context Usage, and Console Summary */}
      <Box alignItems="center" justifyContent="flex-end" marginRight={2}>
        {rightItems.map(({ key, node }, index) => (
          <Box key={key} alignItems="center">
            {index > 0 && <Text color={theme.text.secondary}> | </Text>}
            {node}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
