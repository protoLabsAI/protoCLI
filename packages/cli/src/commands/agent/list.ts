/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'proto agent list' (and the top-level 'proto agents') command.
import type { CommandModule } from 'yargs';
import { loadSettings } from '../../config/settings.js';
import { writeStdoutLine } from '../../utils/stdioHelpers.js';
import { configuredEntries, mergeAgents } from '../../a2a-client/registry.js';
import { discover } from '../../a2a-client/discovery.js';
import { A2aClient } from '../../a2a-client/client.js';
import type { AgentEntry } from '../../a2a-client/types.js';

export async function listAgents(opts: { scan: boolean }): Promise<void> {
  const settings = loadSettings(process.cwd());
  const configured = configuredEntries(settings.merged.a2aAgents);

  let entries: AgentEntry[] = configured;
  if (opts.scan) {
    const discovered = await discover();
    entries = mergeAgents(configured, discovered);
  }

  // Health-probe everything in parallel (cheap; converges on the agent card).
  await Promise.all(
    entries.map(async (e) => {
      if (e.reachable !== undefined) return;
      const card = await new A2aClient(e.url).agentCard(1500);
      e.reachable = card !== null;
      e.cardName = (card?.['name'] as string) || e.cardName;
    }),
  );

  if (entries.length === 0) {
    writeStdoutLine('No A2A agents registered or discovered.');
    writeStdoutLine('Register one:  proto agent add <name> <url>');
    writeStdoutLine(
      'Or scan again: proto agents   (auto-discovers agents on :7870-7879)',
    );
    return;
  }

  const nameW = Math.max(4, ...entries.map((e) => e.name.length));
  writeStdoutLine(
    `${'NAME'.padEnd(nameW)}  ${'STATUS'.padEnd(6)}  ${'SOURCE'.padEnd(7)}  URL`,
  );
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const status = e.reachable ? 'up' : 'down';
    writeStdoutLine(
      `${e.name.padEnd(nameW)}  ${status.padEnd(6)}  ${e.source.padEnd(7)}  ${e.url}`,
    );
  }
  writeStdoutLine('');
  writeStdoutLine('Connect:  proto agent <name>');
}

export const listCommand: CommandModule = {
  command: 'list',
  aliases: ['ls'],
  describe: 'List registered and discovered A2A agents',
  builder: (yargs) =>
    yargs.option('no-scan', {
      describe: 'Skip network discovery; show only registered agents',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    await listAgents({ scan: !argv['noScan'] });
  },
};
