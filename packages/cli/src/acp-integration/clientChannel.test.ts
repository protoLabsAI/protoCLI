/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { methods, type AgentContext } from '@agentclientprotocol/sdk';
import { AgentContextChannel } from './clientChannel.js';

/**
 * A fake AgentContext capturing the (method, params) pairs passed to
 * notify/request, so we can assert the channel maps each call to the correct
 * ACP method literal.
 */
function makeFakeContext() {
  const notify = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ ok: true });
  const ctx = { notify, request } as unknown as AgentContext;
  return { ctx, notify, request };
}

describe('AgentContextChannel', () => {
  it('maps each outbound method to the correct ACP method literal', async () => {
    const { ctx, notify, request } = makeFakeContext();
    const channel = new AgentContextChannel(ctx, Promise.resolve());

    const updateParams = { sessionId: 's', update: { sessionUpdate: 'x' } };
    await channel.sessionUpdate(updateParams as never);
    expect(notify).toHaveBeenCalledWith(
      methods.client.session.update,
      updateParams,
    );

    const permParams = { sessionId: 's', toolCall: {} };
    await channel.requestPermission(permParams as never);
    expect(request).toHaveBeenCalledWith(
      methods.client.session.requestPermission,
      permParams,
    );

    const readParams = { sessionId: 's', path: '/a' };
    await channel.readTextFile(readParams as never);
    expect(request).toHaveBeenCalledWith(
      methods.client.fs.readTextFile,
      readParams,
    );

    const writeParams = { sessionId: 's', path: '/a', content: 'x' };
    await channel.writeTextFile(writeParams as never);
    expect(request).toHaveBeenCalledWith(
      methods.client.fs.writeTextFile,
      writeParams,
    );
  });

  it('forwards custom notifications verbatim via extNotification', async () => {
    const { ctx, notify } = makeFakeContext();
    const channel = new AgentContextChannel(ctx, Promise.resolve());

    await channel.extNotification('_qwencode/slash_command', {
      sessionId: 's',
    });
    expect(notify).toHaveBeenCalledWith('_qwencode/slash_command', {
      sessionId: 's',
    });
  });

  it('exposes the connection-closed promise it was constructed with', async () => {
    const { ctx } = makeFakeContext();
    const closed = Promise.resolve();
    const channel = new AgentContextChannel(ctx, closed);
    expect(channel.closed).toBe(closed);
  });

  it('keeps emitting after the originating handler would have returned', async () => {
    // The context wraps the connection's long-lived singleton context, so a
    // captured channel must stay usable for background work (cron, post-turn
    // harness) that emits after its handler resolves. Simulate that gap with a
    // microtask + timer before emitting.
    const { ctx, notify } = makeFakeContext();
    const channel = new AgentContextChannel(ctx, Promise.resolve());

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    await channel.sessionUpdate({ sessionId: 's', update: {} } as never);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
