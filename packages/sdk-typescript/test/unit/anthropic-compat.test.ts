/**
 * @license
 * Copyright 2025 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for the @protolabsai/sdk/anthropic-compat layer.
 *
 * Focus: the option-widening / translation work from #256 — the compat surface
 * must absorb real `@anthropic-ai/claude-agent-sdk` consumers (3-arg
 * HookCallback, structured systemPrompt, structured mcpServers, structured
 * outputFormat) without per-callsite casts, and translate them into proto's
 * native QueryOptions at runtime.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Capture the options handed to proto's underlying query() so we can assert on
// the translation without spawning a real transport.
const protoQueryMock = vi.fn(() => ({}) as never);
vi.mock('../../src/query/createQuery.js', () => ({
  query: (args: unknown) => protoQueryMock(args),
}));

const importCompat = async () => await import('../../src/anthropic-compat.js');

beforeEach(() => {
  protoQueryMock.mockClear();
});

describe('anthropic-compat option translation', () => {
  it('maps a structured systemPrompt preset onto proto, preserving append', async () => {
    const { query } = await importCompat();
    query({
      prompt: 'hi',
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: 'Be concise.',
        },
      },
    });
    const opts = (
      protoQueryMock.mock.calls[0]![0] as { options: Record<string, unknown> }
    ).options;
    expect(opts.systemPrompt).toEqual({
      type: 'preset',
      preset: 'qwen_code',
      append: 'Be concise.',
    });
  });

  it('passes a plain string systemPrompt through verbatim', async () => {
    const { query } = await importCompat();
    query({ prompt: 'hi', options: { systemPrompt: 'You are helpful.' } });
    const opts = (
      protoQueryMock.mock.calls[0]![0] as { options: Record<string, unknown> }
    ).options;
    expect(opts.systemPrompt).toBe('You are helpful.');
  });

  it('passes structured mcpServers through verbatim', async () => {
    const { query } = await importCompat();
    const mcpServers = {
      fs: { command: 'mcp-fs', args: ['--root', '/'], env: {} },
    };
    query({ prompt: 'hi', options: { mcpServers } });
    const opts = (
      protoQueryMock.mock.calls[0]![0] as { options: Record<string, unknown> }
    ).options;
    expect(opts.mcpServers).toEqual(mcpServers);
  });

  it('drops the Claude-only outputFormat at runtime', async () => {
    const { query } = await importCompat();
    query({
      prompt: 'hi',
      options: {
        outputFormat: { type: 'json_schema', schema: { type: 'object' } },
      },
    });
    const opts = (
      protoQueryMock.mock.calls[0]![0] as { options: Record<string, unknown> }
    ).options;
    expect(opts.outputFormat).toBeUndefined();
  });
});

describe('anthropic-compat HookCallback 3-arg shape', () => {
  it('invokes the Claude hook with (input, toolUseId, { signal }) and translates a block', async () => {
    const { query } = await importCompat();
    const received: Array<unknown[]> = [];
    const hook = vi.fn((...args: unknown[]) => {
      received.push(args);
      return { decision: 'block' as const, reason: 'nope' };
    });

    query({
      prompt: 'hi',
      options: { hooks: { PreToolUse: [{ hooks: [hook] }] } },
    });

    const opts = (
      protoQueryMock.mock.calls[0]![0] as {
        options: {
          hookCallbacks: Record<string, Array<(...a: unknown[]) => unknown>>;
        };
      }
    ).options;
    const wrapped = opts.hookCallbacks.PreToolUse![0]!;

    // proto invokes the wrapper as (input, toolUseId)
    const result = await wrapped(
      { tool_name: 'Bash', tool_input: {} },
      'tool-use-123',
    );

    // Claude callback saw the full 3-arg contract.
    expect(hook).toHaveBeenCalledTimes(1);
    const [input, toolUseId, options] = received[0]!;
    expect((input as { hook_event_name: string }).hook_event_name).toBe(
      'PreToolUse',
    );
    expect(toolUseId).toBe('tool-use-123');
    expect((options as { signal: AbortSignal }).signal).toBeInstanceOf(
      AbortSignal,
    );
    expect((options as { signal: AbortSignal }).signal.aborted).toBe(false);

    // block → proto's { shouldSkip, message }
    expect(result).toEqual({ shouldSkip: true, message: 'nope' });
  });

  it('threads the Options.abortController signal into the hook', async () => {
    const { query } = await importCompat();
    const ac = new AbortController();
    let seen: AbortSignal | undefined;
    const hook = vi.fn(
      (_input: unknown, _id: unknown, o: { signal: AbortSignal }) => {
        seen = o.signal;
      },
    );

    query({
      prompt: 'hi',
      options: {
        abortController: ac,
        hooks: { Stop: [{ hooks: [hook] }] },
      },
    });

    const opts = (
      protoQueryMock.mock.calls[0]![0] as {
        options: {
          hookCallbacks: Record<string, Array<(...a: unknown[]) => unknown>>;
        };
      }
    ).options;
    await opts.hookCallbacks.Stop![0]!({}, undefined);

    expect(seen).toBe(ac.signal);
  });
});
