/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'proto agent <name>' / 'proto agent connect <name>' — open an
// interactive A2A chat with a registered or discovered agent.
import type { CommandModule } from 'yargs';
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadSettings } from '../../config/settings.js';
import { writeStdoutLine, writeStderrLine } from '../../utils/stdioHelpers.js';
import { A2aClient } from '../../a2a-client/client.js';
import { buildClient, resolveConfigured } from '../../a2a-client/registry.js';
import { discover } from '../../a2a-client/discovery.js';

const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

/** Resolve a name to a client: registered config first, then live discovery. */
async function resolve(
  name: string,
): Promise<{ client: A2aClient; url: string } | null> {
  const settings = loadSettings(process.cwd());
  const cfg = resolveConfigured(name, settings.merged.a2aAgents);
  if (cfg) return { client: buildClient(cfg), url: cfg.url };

  // Not registered — try discovery (match by registered name or agent-card name).
  const discovered = await discover();
  const hit = discovered.find(
    (d) => d.name === name || d.cardName === name || d.url.includes(name),
  );
  if (hit) return { client: new A2aClient(hit.url), url: hit.url };
  return null;
}

export async function connectAndChat(name: string): Promise<void> {
  const resolved = await resolve(name);
  if (!resolved) {
    writeStderrLine(`No agent named "${name}" is registered or discoverable.`);
    writeStderrLine(
      '  proto agents              # list registered + discovered',
    );
    writeStderrLine(`  proto agent add ${name} <url>   # register it`);
    process.exit(1);
  }
  const { client, url } = resolved;

  const card = await client.agentCard(3000);
  if (!card) {
    writeStderrLine(`"${name}" (${url}) is not reachable.`);
    process.exit(1);
  }
  const agentName = (card['name'] as string) || name;
  const skills = ((card['skills'] as Array<Record<string, unknown>>) || [])
    .map((s) => (s['id'] as string) || (s['name'] as string))
    .filter(Boolean);

  writeStdoutLine(
    `${CYAN}Connected to ${agentName}${RESET} ${DIM}(${url})${RESET}`,
  );
  if (skills.length)
    writeStdoutLine(`${DIM}skills: ${skills.join(', ')}${RESET}`);
  writeStdoutLine(`${DIM}Type a message. Ctrl-C or /exit to quit.${RESET}\n`);

  // Pin one contextId for the whole session so the agent keeps memory across turns.
  const contextId = randomUUID();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let inflight: AbortController | null = null;
  rl.on('SIGINT', () => {
    if (inflight) inflight.abort();
    else {
      rl.close();
    }
  });

  try {
    for (;;) {
      let line: string;
      try {
        line = (await rl.question('› ')).trim();
      } catch {
        break; // closed
      }
      if (!line) continue;
      if (line === '/exit' || line === '/quit') break;

      inflight = new AbortController();
      let wroteText = false;
      let lastTaskId = '';
      try {
        for await (const ev of client.streamMessage(line, {
          contextId,
          signal: inflight.signal,
        })) {
          switch (ev.kind) {
            case 'task':
              lastTaskId = ev.taskId;
              break;
            case 'text':
              stdout.write(ev.delta);
              wroteText = true;
              break;
            case 'thought':
              stdout.write(`${DIM}${ev.delta}${RESET}`);
              break;
            case 'tool':
              if (ev.phase === 'started')
                stdout.write(`${DIM}\n  ⚙ ${ev.name}…${RESET}\n`);
              break;
            case 'inputRequired':
              stdout.write(`\n${CYAN}[input requested]${RESET} ${ev.prompt}\n`);
              break;
            case 'final': {
              if (wroteText) stdout.write('\n');
              if (ev.usage) {
                const u = ev.usage;
                writeStdoutLine(
                  `${DIM}  [${ev.state}] ${u['input_tokens'] ?? 0}→${u['output_tokens'] ?? 0} tok${ev.confidence != null ? `, conf ${ev.confidence}` : ''}${RESET}`,
                );
              }
              break;
            }
            case 'error':
              stdout.write(`\n${CYAN}[error]${RESET} ${ev.message}\n`);
              break;
            default:
              break;
          }
        }
      } catch (e) {
        if (inflight.signal.aborted) {
          if (lastTaskId) await client.cancel(lastTaskId);
          stdout.write(`${DIM} (cancelled)${RESET}\n`);
        } else {
          writeStderrLine(`\nerror: ${(e as Error).message}`);
        }
      } finally {
        inflight = null;
      }
      stdout.write('\n');
    }
  } finally {
    rl.close();
  }
  writeStdoutLine(`${DIM}Disconnected.${RESET}`);
}

export const connectCommand: CommandModule = {
  command: 'connect <name>',
  describe: 'Open an interactive chat with a registered or discovered agent',
  builder: (yargs) =>
    yargs.positional('name', {
      describe: 'Registered agent name (or a discovered agent name)',
      type: 'string',
      demandOption: true,
    }),
  handler: async (argv) => {
    await connectAndChat(argv['name'] as string);
  },
};
