/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, SlashCommandActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const rewindCommand: SlashCommand = {
  name: 'rewind',
  altNames: ['undo'],
  description:
    'Open the rewind dialog to select a conversation turn to rewind to',
  kind: CommandKind.BUILT_IN,
  action: async (
    _context,
    _args,
  ): Promise<void | SlashCommandActionReturn> => ({
    type: 'dialog',
    dialog: 'rewind',
  }),
};
