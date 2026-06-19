/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'proto agent add' command — register an A2A agent by name.
import type { CommandModule } from 'yargs';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { writeStdoutLine, writeStderrLine } from '../../utils/stdioHelpers.js';
import type { A2aAgentConfig } from '../../a2a-client/types.js';

export const addCommand: CommandModule = {
  command: 'add <name> <url>',
  describe:
    'Register an A2A agent under a name (so you connect with its name, not a URL)',
  builder: (yargs) =>
    yargs
      .usage('Usage: proto agent add <name> <url> [options]')
      .positional('name', {
        describe: 'Shortcut name for the agent',
        type: 'string',
        demandOption: true,
      })
      .positional('url', {
        describe: 'Agent base URL, e.g. http://host:7870',
        type: 'string',
        demandOption: true,
      })
      .option('scope', {
        alias: 's',
        describe: 'Configuration scope',
        type: 'string',
        default: 'user',
        choices: ['user', 'project'],
      })
      .option('header', {
        alias: 'H',
        describe: 'Static HTTP header, e.g. -H "Authorization: Bearer abc"',
        type: 'array',
        string: true,
        nargs: 1,
      })
      .option('bearer-env', {
        describe:
          'Env var holding a Bearer token (sent as Authorization: Bearer <value>)',
        type: 'string',
      })
      .option('api-key-env', {
        describe: 'Env var holding an X-API-Key value',
        type: 'string',
      })
      .option('description', {
        describe: 'Human description shown in `proto agents`',
        type: 'string',
      }),
  handler: async (argv) => {
    const name = argv['name'] as string;
    const url = argv['url'] as string;
    const scope = argv['scope'] as string;

    const settings = loadSettings(process.cwd());
    const inHome = settings.workspace.path === settings.user.path;
    if (scope === 'project' && inHome) {
      writeStderrLine(
        'Error: Please use --scope user to edit settings in the home directory.',
      );
      process.exit(1);
    }
    const settingsScope =
      scope === 'user' ? SettingScope.User : SettingScope.Workspace;

    const headers = (argv['header'] as string[] | undefined)?.reduce(
      (acc, curr) => {
        const [key, ...rest] = curr.split(':');
        const value = rest.join(':').trim();
        if (key.trim() && value) acc[key.trim()] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const config: A2aAgentConfig = {
      url,
      ...(headers && Object.keys(headers).length ? { headers } : {}),
      ...(argv['bearerEnv'] ? { bearerEnv: argv['bearerEnv'] as string } : {}),
      ...(argv['apiKeyEnv'] ? { apiKeyEnv: argv['apiKeyEnv'] as string } : {}),
      ...(argv['description']
        ? { description: argv['description'] as string }
        : {}),
    };

    const existing = settings.forScope(settingsScope).settings.a2aAgents || {};
    const isUpdate = !!existing[name];
    existing[name] = config;
    settings.setValue(settingsScope, 'a2aAgents', existing);

    writeStdoutLine(
      `A2A agent "${name}" ${isUpdate ? 'updated' : 'added'} in ${scope} settings → ${url}`,
    );
    writeStdoutLine(`Connect with:  proto agent ${name}`);
  },
};
