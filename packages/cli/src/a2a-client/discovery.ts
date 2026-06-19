/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent discovery — find agents on the system/network so you don't have to type
 * URLs. Mirrors protoAgent's broadcast/scan protocol (`graph/fleet/discovery.py`,
 * ADR 0042 §I), which runs three channels — localhost port-scan, mDNS browse of
 * `_protoagent._tcp`, and Tailscale-peer scan — all converging on each agent's
 * `/.well-known/agent-card.json`.
 *
 * Implemented here: the zero-dependency **localhost port-scan** (the common case:
 * a protoAgent on :7870). The **mDNS** channel (LAN broadcast) and the Tailscale
 * channel are the next adds — see `mdnsBrowse` below.
 */

import { A2aClient } from './client.js';
import type { AgentEntry } from './types.js';

/** Default fleet port range to probe on localhost (protoAgent prod :7870 / dev
 * :7871 and nearby forks). Overridable by the caller. */
export const DEFAULT_PORT_RANGE: [number, number] = [7870, 7879];

/** Probe one host:port for an agent card; return an entry if one answers. */
async function probe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<AgentEntry | null> {
  const url = `http://${host}:${port}`;
  const card = await new A2aClient(url).agentCard(timeoutMs);
  if (!card) return null;
  return {
    name: (card['name'] as string) || `${host}:${port}`,
    url,
    source: 'scan',
    cardName: card['name'] as string | undefined,
    reachable: true,
  };
}

/** Port-scan localhost across a range for agent cards. */
export async function scanLocal(
  range: [number, number] = DEFAULT_PORT_RANGE,
  opts: { host?: string; timeoutMs?: number } = {},
): Promise<AgentEntry[]> {
  const host = opts.host ?? '127.0.0.1';
  const timeoutMs = opts.timeoutMs ?? 700;
  const [lo, hi] = range;
  const ports: number[] = [];
  for (let p = lo; p <= hi; p++) ports.push(p);
  const results = await Promise.all(
    ports.map((p) => probe(host, p, timeoutMs)),
  );
  return results.filter((r): r is AgentEntry => r !== null);
}

/**
 * mDNS browse of `_protoagent._tcp.local.` — the LAN broadcast channel.
 * Stubbed: returns []. Implementing needs an mDNS lib (`multicast-dns` /
 * `bonjour-service`); planned as the next discovery add so LAN agents auto-appear.
 */
export async function mdnsBrowse(): Promise<AgentEntry[]> {
  return [];
}

/** Run all available discovery channels and merge, de-duplicated by URL. */
export async function discover(
  opts: { range?: [number, number]; timeoutMs?: number } = {},
): Promise<AgentEntry[]> {
  const channels = await Promise.all([
    scanLocal(opts.range, { timeoutMs: opts.timeoutMs }),
    mdnsBrowse(),
  ]);
  const byUrl = new Map<string, AgentEntry>();
  for (const entry of channels.flat()) {
    if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  }
  return [...byUrl.values()];
}
