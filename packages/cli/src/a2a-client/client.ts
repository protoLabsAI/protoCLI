/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A2A 1.0 client — drive a remote agent (e.g. protoAgent) over HTTP JSON-RPC + SSE.
 *
 * Mirrors protoAgent's canonical reference client (`evals/client.py`) and the
 * validated wire spike. Key facts baked in:
 *   - `A2A-Version: 1.0` header is MANDATORY — without it the server's a2a-sdk
 *     treats the call as 0.3 and rejects the 1.0 proto methods.
 *   - Methods are gRPC-style: `SendStreamingMessage`, `SendMessage`, `GetTask`,
 *     `CancelTask` (NOT `message/send` / `tasks/get`).
 *   - A message is `{role:"ROLE_USER", parts:[{text}], messageId, contextId?}`;
 *     `contextId` lives INSIDE the message (params-level is a -32602) and pins
 *     the conversation thread for multi-turn memory.
 *   - SSE: each `data:` line is a JSON-RPC response whose `result` is a oneof —
 *     one of `task | statusUpdate | artifactUpdate | message`.
 */

import { randomUUID } from 'node:crypto';
import type { A2aStreamEvent } from './types.js';

/** cost-v1 / confidence-v1 DataParts ride under these MIMEs (metadata.mimeType). */
const isUsagePart = (
  p: Record<string, unknown>,
): p is { data: { usage: Record<string, number> } } =>
  typeof p['data'] === 'object' &&
  p['data'] !== null &&
  typeof (p['data'] as Record<string, unknown>)['usage'] === 'object';

/** `TASK_STATE_COMPLETED` → `completed`; pass through already-lowercased states. */
export function normState(state: string | undefined): string {
  if (!state) return '';
  return state.startsWith('TASK_STATE_')
    ? state.slice('TASK_STATE_'.length).toLowerCase()
    : state;
}

export function isTerminal(state: string | undefined): boolean {
  return ['completed', 'failed', 'canceled', 'input_required'].includes(
    normState(state),
  );
}

export interface A2aClientOptions {
  headers?: Record<string, string>;
  /** Bearer token (sent as Authorization: Bearer …). */
  bearer?: string;
  /** Legacy X-API-Key value. */
  apiKey?: string;
}

export class A2aClient {
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(baseUrl: string, opts: A2aClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    // `A2A-Version: 1.0` is mandatory (see class docstring) and is applied AFTER
    // the user headers so a stray `A2A-Version` in config can't clobber it and
    // silently break the client (server would then reject the 1.0 methods).
    this.headers = {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
      'A2A-Version': '1.0',
    };
    if (opts.bearer) this.headers['Authorization'] = `Bearer ${opts.bearer}`;
    if (opts.apiKey) this.headers['X-API-Key'] = opts.apiKey;
  }

  /** GET the agent card. Returns null if unreachable (used by discovery/health). */
  async agentCard(timeoutMs = 2000): Promise<Record<string, unknown> | null> {
    try {
      const r = await fetch(`${this.baseUrl}/.well-known/agent-card.json`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return null;
      return (await r.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Cancel an in-flight task (gRPC `CancelTask`). Best-effort. */
  async cancel(taskId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'c',
          method: 'CancelTask',
          params: { id: taskId },
        }),
      });
    } catch {
      // best-effort
    }
  }

  /**
   * Send one user turn and stream normalized events. Reuse the same `contextId`
   * across calls for a continuous conversation/memory thread.
   */
  async *streamMessage(
    text: string,
    opts: { contextId?: string; signal?: AbortSignal } = {},
  ): AsyncGenerator<A2aStreamEvent> {
    const messageId = randomUUID();
    const message: Record<string, unknown> = {
      role: 'ROLE_USER',
      parts: [{ text }],
      messageId,
    };
    if (opts.contextId) message['contextId'] = opts.contextId;
    const payload = {
      jsonrpc: '2.0',
      id: messageId,
      method: 'SendStreamingMessage',
      params: { message },
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: opts.signal,
      });
    } catch (e) {
      yield {
        kind: 'error',
        message: `request failed: ${(e as Error).message}`,
      };
      return;
    }
    if (!res.ok || !res.body) {
      const body = res.body ? await res.text() : '';
      yield {
        kind: 'error',
        message: `HTTP ${res.status}: ${body.slice(0, 300)}`,
      };
      return;
    }

    let taskId = '';
    let usage: Record<string, number> | undefined;
    let confidence: number | undefined;
    let finalState = '';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    // Release the underlying response stream on early break (terminal frame),
    // abort, or consumer abandonment — otherwise the reader/connection leaks.
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || line.startsWith(':') || !line.startsWith('data:'))
            continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (data['error']) {
            yield { kind: 'error', message: JSON.stringify(data['error']) };
            return;
          }
          const result = (data['result'] ?? {}) as Record<string, unknown>;
          const kind = Object.keys(result)[0];
          if (!kind) continue;
          const p = (result[kind] ?? {}) as Record<string, unknown>;

          if (kind === 'task') {
            taskId = (p['id'] as string) || taskId;
            yield { kind: 'task', taskId };
          } else if (kind === 'artifactUpdate') {
            taskId = (p['taskId'] as string) || taskId;
            const artifact = (p['artifact'] ?? {}) as Record<string, unknown>;
            for (const part of (artifact['parts'] as Array<
              Record<string, unknown>
            >) ?? []) {
              if (typeof part['text'] === 'string' && part['text']) {
                yield { kind: 'text', delta: part['text'] as string };
              } else if (isUsagePart(part)) {
                usage = part.data.usage;
              } else if (
                typeof (part['data'] as Record<string, unknown>)?.[
                  'confidence'
                ] === 'number'
              ) {
                confidence = (part['data'] as Record<string, number>)[
                  'confidence'
                ];
              }
            }
          } else if (kind === 'statusUpdate') {
            taskId = (p['taskId'] as string) || taskId;
            const status = (p['status'] ?? {}) as Record<string, unknown>;
            const state = normState(status['state'] as string);
            // tool-call-v1 / reasoning-v1 / hitl-v1 ride on the status message parts.
            const msg = (status['message'] ?? {}) as Record<string, unknown>;
            for (const part of (msg['parts'] as Array<
              Record<string, unknown>
            >) ?? []) {
              const d = part['data'] as Record<string, unknown> | undefined;
              if (d?.['toolCallId'] && d?.['name']) {
                yield {
                  kind: 'tool',
                  phase:
                    (d['phase'] as 'started' | 'completed' | 'failed') ??
                    'started',
                  name: String(d['name']),
                  toolCallId: String(d['toolCallId']),
                };
              } else if (
                typeof d?.['text'] === 'string' &&
                'reasoning' in (d ?? {})
              ) {
                yield { kind: 'thought', delta: String(d['text']) };
              }
            }
            if (state === 'input_required') {
              const promptPart = (
                (msg['parts'] as Array<Record<string, unknown>>) ?? []
              ).find((x) => typeof x['text'] === 'string');
              yield {
                kind: 'inputRequired',
                taskId,
                prompt: (promptPart?.['text'] as string) ?? 'Input required.',
              };
            }
            yield { kind: 'status', state, final: Boolean(p['final']) };
            if (p['final'] || isTerminal(state)) {
              finalState = state;
            }
          }
        }
        if (finalState) break;
      }
    } finally {
      void reader.cancel().catch(() => {});
    }

    yield {
      kind: 'final',
      taskId,
      state: finalState || 'unknown',
      usage,
      confidence,
    };
  }
}
