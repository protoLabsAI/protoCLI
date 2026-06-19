/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A registered A2A agent — a named shortcut so you connect with `proto agent
 * <name>` instead of typing a URL every time. Persisted under the `a2aAgents`
 * settings section (shaped like `mcpServers`).
 */
export interface A2aAgentConfig {
  /** The agent's base URL (e.g. http://host:7870). The `/a2a` JSON-RPC path and
   * `/.well-known/agent-card.json` are derived from it. */
  url: string;
  /** Extra HTTP headers sent on every request (e.g. a static Authorization). */
  headers?: Record<string, string>;
  /** Env var holding a Bearer token, sent as `Authorization: Bearer <value>`. */
  bearerEnv?: string;
  /** Env var holding an X-API-Key value. */
  apiKeyEnv?: string;
  /** Optional human description shown in `proto agents`. */
  description?: string;
}

/** How an agent entry was found, for the `proto agents` listing. */
export type AgentSource = 'config' | 'scan' | 'mdns';

/** A resolved agent for listing/connecting — a config entry and/or a live find. */
export interface AgentEntry {
  name: string;
  url: string;
  source: AgentSource;
  /** Filled by discovery/health probe: the agent card name + reachability. */
  cardName?: string;
  reachable?: boolean;
}

/**
 * A normalized streaming event from an A2A turn. The terminal chat renders
 * these directly; a later adapter maps them onto proto's `ServerGeminiStreamEvent`
 * so the full Ink TUI can consume an A2A stream unchanged.
 */
export type A2aStreamEvent =
  | { kind: 'task'; taskId: string }
  | { kind: 'text'; delta: string }
  | { kind: 'thought'; delta: string }
  | {
      kind: 'tool';
      phase: 'started' | 'completed' | 'failed';
      name: string;
      toolCallId: string;
    }
  | { kind: 'status'; state: string; final: boolean }
  | { kind: 'inputRequired'; taskId: string; prompt: string; form?: unknown }
  | {
      kind: 'final';
      taskId: string;
      state: string;
      usage?: Record<string, number>;
      confidence?: number;
    }
  | { kind: 'error'; message: string };
