/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, SlashCommandActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Finds the index in the UI history array where the Nth-to-last user turn begins.
 * Returns -1 if there aren't enough user turns.
 */
function findRewindIndex(history: Array<{ type: string }>, turns: number): number {
  let found = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].type === 'user') {
      found++;
      if (found === turns) {
        return i;
      }
    }
  }
  return -1;
}

export const rewindCommand: SlashCommand = {
  name: 'rewind',
  altNames: ['undo'],
  description: 'Remove the last N conversation turns (default: 1)',
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<void | SlashCommandActionReturn> => {
    const { config } = context.services;
    const { history, loadHistory, addItem } = context.ui;

    const turns = Math.max(1, parseInt(args?.trim() || '1', 10) || 1);

    const rewindIdx = findRewindIndex(history, turns);

    if (rewindIdx === -1) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          turns === 1
            ? 'Nothing to rewind — no user turns in history.'
            : `Cannot rewind ${turns} turns — only ${history.filter((h) => h.type === 'user').length} user turn(s) in history.`,
      };
    }

    // Slice UI history
    const newUiHistory = history.slice(0, rewindIdx);
    loadHistory(newUiHistory);

    // Slice LLM history: find the Nth-to-last user Content entry
    const geminiClient = config?.getGeminiClient();
    if (geminiClient) {
      const llmHistory = geminiClient.getHistory();
      let userCount = 0;
      let llmCutIdx = -1;
      for (let i = llmHistory.length - 1; i >= 0; i--) {
        if (llmHistory[i].role === 'user') {
          userCount++;
          if (userCount === turns) {
            llmCutIdx = i;
            break;
          }
        }
      }
      const newLlmHistory =
        llmCutIdx >= 0 ? llmHistory.slice(0, llmCutIdx) : [];
      geminiClient.setHistory(newLlmHistory);
    }

    addItem(
      {
        type: 'info',
        text: turns === 1 ? 'Rewound 1 turn.' : `Rewound ${turns} turns.`,
      },
      Date.now(),
    );
  },
};
