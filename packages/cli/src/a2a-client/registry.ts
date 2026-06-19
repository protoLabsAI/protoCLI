/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The A2A agent registry — named shortcuts so you connect with `proto agent
 * <name>` instead of a URL. Configured agents live in the `a2aAgents` settings
 * section; discovered agents (port-scan / mDNS) are merged in for listing.
 */

import { A2aClient } from './client.js';
import type { A2aAgentConfig, AgentEntry } from './types.js';

/** Build an authed client from a registered agent config, resolving env-held creds. */
export function buildClient(config: A2aAgentConfig): A2aClient {
  return new A2aClient(config.url, {
    headers: config.headers,
    bearer: config.bearerEnv ? process.env[config.bearerEnv] : undefined,
    apiKey: config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined,
  });
}

/** Turn the `a2aAgents` settings record into listing entries (source: config). */
export function configuredEntries(
  agents: Record<string, A2aAgentConfig> | undefined,
): AgentEntry[] {
  return Object.entries(agents ?? {}).map(([name, cfg]) => ({
    name,
    url: cfg.url,
    source: 'config' as const,
  }));
}

/**
 * Merge configured + discovered entries for `proto agents`. Configured entries
 * win (by name); a discovered agent already registered (same URL) is folded into
 * its config entry rather than duplicated.
 */
export function mergeAgents(
  configured: AgentEntry[],
  discovered: AgentEntry[],
): AgentEntry[] {
  const configuredUrls = new Set(
    configured.map((a) => a.url.replace(/\/$/, '')),
  );
  const extras = discovered.filter(
    (d) => !configuredUrls.has(d.url.replace(/\/$/, '')),
  );
  return [...configured, ...extras];
}

/**
 * Resolve a name to a registered config. Returns undefined if not registered —
 * callers may then fall back to discovery (a discovered agent's card name).
 */
export function resolveConfigured(
  name: string,
  agents: Record<string, A2aAgentConfig> | undefined,
): A2aAgentConfig | undefined {
  return agents?.[name];
}
