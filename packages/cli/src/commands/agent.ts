/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

// 'proto agent' — talk to / manage A2A agents (protoAgent & any A2A 1.0 agent).
import type { CommandModule, Argv } from 'yargs';
import { addCommand } from './agent/add.js';
import { removeCommand } from './agent/remove.js';
import { listCommand, listAgents } from './agent/list.js';
import { connectCommand, connectAndChat } from './agent/connect.js';

export const agentCommand: CommandModule = {
  command: 'agent [name]',
  describe:
    'Talk to an A2A agent by name (proto agent <name>), or manage the registry',
  builder: (yargs: Argv) =>
    yargs
      .command(addCommand)
      .command(removeCommand)
      .command(listCommand)
      .command(connectCommand)
      .positional('name', {
        describe: 'Registered/discovered agent name to connect to',
        type: 'string',
      })
      .version(false),
  handler: async (argv) => {
    const name = argv['name'] as string | undefined;
    if (name) {
      await connectAndChat(name);
    } else {
      // `proto agent` with no name → show what's available.
      await listAgents({ scan: true });
    }
  },
};

/** Top-level alias: `proto agents` == `proto agent list`. */
export const agentsCommand: CommandModule = {
  command: 'agents',
  describe: 'List registered and discovered A2A agents',
  builder: (yargs: Argv) =>
    yargs.option('no-scan', {
      describe: 'Skip network discovery; show only registered agents',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    await listAgents({ scan: !argv['noScan'] });
  },
};
