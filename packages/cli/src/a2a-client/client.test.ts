/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { A2aClient, normState, isTerminal } from './client.js';
import { configuredEntries, mergeAgents } from './registry.js';
import type { A2aStreamEvent } from './types.js';

function sseResponse(frames: unknown[]): Response {
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Chunk mid-line to exercise the buffering (split every 17 bytes).
      const bytes = new TextEncoder().encode(body);
      for (let i = 0; i < bytes.length; i += 17)
        controller.enqueue(bytes.slice(i, i + 17));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function collect(
  gen: AsyncGenerator<A2aStreamEvent>,
): Promise<A2aStreamEvent[]> {
  const out: A2aStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('normState / isTerminal', () => {
  it('strips the TASK_STATE_ prefix and lowercases', () => {
    expect(normState('TASK_STATE_COMPLETED')).toBe('completed');
    expect(normState('working')).toBe('working');
    expect(normState(undefined)).toBe('');
  });
  it('recognizes terminal states (incl. input_required)', () => {
    expect(isTerminal('TASK_STATE_COMPLETED')).toBe(true);
    expect(isTerminal('input_required')).toBe(true);
    expect(isTerminal('working')).toBe(false);
  });
});

describe('A2aClient.streamMessage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the A2A 1.0 SendStreamingMessage shape with the mandatory version header', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      captured = { url, init };
      return Promise.resolve(
        sseResponse([
          { result: { task: { id: 't1' } } },
          {
            result: {
              statusUpdate: {
                taskId: 't1',
                status: { state: 'TASK_STATE_COMPLETED' },
                final: true,
              },
            },
          },
        ]),
      );
    });

    const client = new A2aClient('http://host:7870', { bearer: 'tok' });
    await collect(client.streamMessage('hi', { contextId: 'ctx-1' }));

    expect(captured!.url).toBe('http://host:7870/a2a');
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers['A2A-Version']).toBe('1.0'); // mandatory — missing → server rejects 1.0 methods
    expect(headers['Authorization']).toBe('Bearer tok');
    const sent = JSON.parse(captured!.init.body as string);
    expect(sent.method).toBe('SendStreamingMessage');
    expect(sent.params.message.role).toBe('ROLE_USER');
    expect(sent.params.message.parts).toEqual([{ text: 'hi' }]);
    expect(sent.params.message.contextId).toBe('ctx-1'); // contextId lives INSIDE the message
  });

  it('maps SSE oneof frames to normalized events (text, tool, usage, terminal)', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        sseResponse([
          { result: { task: { id: 'task-9' } } },
          {
            result: {
              statusUpdate: {
                taskId: 'task-9',
                status: {
                  state: 'TASK_STATE_WORKING',
                  message: {
                    parts: [
                      {
                        data: {
                          toolCallId: 'tc1',
                          name: 'web_search',
                          phase: 'started',
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            result: {
              artifactUpdate: {
                taskId: 'task-9',
                artifact: { parts: [{ text: 'Hello ' }] },
              },
            },
          },
          {
            result: {
              artifactUpdate: {
                taskId: 'task-9',
                artifact: {
                  parts: [
                    { text: 'world' },
                    { data: { usage: { input_tokens: 10, output_tokens: 2 } } },
                  ],
                },
              },
            },
          },
          {
            result: {
              statusUpdate: {
                taskId: 'task-9',
                status: { state: 'TASK_STATE_COMPLETED' },
                final: true,
              },
            },
          },
        ]),
      ),
    );

    const events = await collect(
      new A2aClient('http://h:1').streamMessage('go'),
    );
    expect(events.find((e) => e.kind === 'task')).toMatchObject({
      taskId: 'task-9',
    });
    expect(
      events
        .filter((e) => e.kind === 'text')
        .map((e) => (e as { delta: string }).delta)
        .join(''),
    ).toBe('Hello world');
    expect(events.find((e) => e.kind === 'tool')).toMatchObject({
      name: 'web_search',
      phase: 'started',
    });
    const final = events.find((e) => e.kind === 'final') as {
      state: string;
      usage?: Record<string, number>;
    };
    expect(final.state).toBe('completed');
    expect(final.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
  });

  it('surfaces a JSON-RPC error frame as an error event', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        sseResponse([{ error: { code: -32601, message: 'MethodNotFound' } }]),
      ),
    );
    const events = await collect(
      new A2aClient('http://h:1').streamMessage('x'),
    );
    expect(events[0]).toMatchObject({ kind: 'error' });
    expect((events[0] as { message: string }).message).toContain(
      'MethodNotFound',
    );
  });
});

describe('registry merge', () => {
  it('lists configured agents and folds in only un-registered discoveries', () => {
    const configured = configuredEntries({
      roxy: { url: 'http://localhost:7870' },
    });
    const discovered = [
      {
        name: 'protoagent',
        url: 'http://localhost:7870/',
        source: 'scan' as const,
      }, // same url (trailing slash) → folded
      { name: 'other', url: 'http://localhost:7872', source: 'scan' as const },
    ];
    const merged = mergeAgents(configured, discovered);
    expect(merged.map((m) => m.name).sort()).toEqual(['other', 'roxy']);
  });
});
