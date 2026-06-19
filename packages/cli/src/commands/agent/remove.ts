/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'proto agent remove' command — unregister an A2A agent.
import type { CommandModule } from 'yargs';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { writeStdoutLine } from '../../utils/stdioHelpers.js';

export const removeCommand: CommandModule = {
  command: 'remove <name>',
  aliases: ['rm'],
  describe: 'Unregister an A2A agent',
  builder: (yargs) =>
    yargs
      .usage('Usage: proto agent remove <name> [--scope user|project]')
      .positional('name', {
        describe: 'Registered agent name',
        type: 'string',
        demandOption: true,
      })
      .option('scope', {
        alias: 's',
        describe: 'Configuration scope',
        type: 'string',
        default: 'user',
        choices: ['user', 'project'],
      }),
  handler: async (argv) => {
    const name = argv['name'] as string;
    const scope = argv['scope'] as string;
    const settingsScope =
      scope === 'user' ? SettingScope.User : SettingScope.Workspace;

    const settings = loadSettings(process.cwd());
    const existing = settings.forScope(settingsScope).settings.a2aAgents || {};
    if (!existing[name]) {
      writeStdoutLine(
        `A2A agent "${name}" is not registered in ${scope} settings.`,
      );
      return;
    }
    delete existing[name];
    settings.setValue(settingsScope, 'a2aAgents', existing);
    writeStdoutLine(`A2A agent "${name}" removed from ${scope} settings.`);
  },
};
