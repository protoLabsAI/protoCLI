/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import {
  client as createClientApp,
  methods,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk';
import { buildAcpApp } from './acpAgent.js';
import type { QwenAgent } from './acpAgent.js';

/**
 * Wiring test for the app-API migration. The principal regression risk is a
 * method that never gets registered — a client call to it returns JSON-RPC
 * "method not found" (-32601). We connect a real in-process client to the app
 * built by `buildAcpApp` and drive every ACP method, asserting none is
 * unregistered. (Asserting "not -32601" rather than handler-success keeps the
 * test robust to per-method param schemas: an invalid-params rejection still
 * proves the method is wired.) Custom passthrough methods and the cancel
 * notification additionally assert the exact impl method, and we confirm the
 * outbound channel is captured.
 */

const METHOD_NOT_FOUND = -32601;

// Minimal-but-plausible responses so the SDK's response handling is happy; the
// assertions only care that the right impl method was invoked.
function makeFakeImpl() {
  const impl = {
    captureChannel: vi.fn(),
    attachConnection: vi.fn(),
    initialize: vi.fn().mockResolvedValue({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {},
      authMethods: [],
    }),
    authenticate: vi.fn().mockResolvedValue({}),
    newSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
    loadSession: vi.fn().mockResolvedValue({}),
    resumeSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
    listSessions: vi.fn().mockResolvedValue({ sessions: [] }),
    setSessionMode: vi.fn().mockResolvedValue({}),
    setSessionConfigOption: vi.fn().mockResolvedValue({ configOptions: [] }),
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    closeSession: vi.fn().mockResolvedValue({}),
    deleteSession: vi.fn().mockResolvedValue({}),
    logout: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue(undefined),
    extMethod: vi.fn().mockResolvedValue({ success: true }),
  };
  return impl;
}

describe('buildAcpApp wiring', () => {
  it('routes every ACP method to its impl handler', async () => {
    const impl = makeFakeImpl();
    const app = buildAcpApp(impl as unknown as QwenAgent);
    const clientApp = createClientApp({ name: 'wiring-test' });

    // Drive each request method and record whether it came back as
    // "method not found" (which is what a forgotten registration produces).
    const notFound: string[] = [];
    await clientApp.connectWith(app, async (ctx) => {
      const requestMethods = [
        methods.agent.initialize,
        methods.agent.authenticate,
        methods.agent.session.new,
        methods.agent.session.load,
        methods.agent.session.resume,
        methods.agent.session.list,
        methods.agent.session.setMode,
        methods.agent.session.setConfigOption,
        methods.agent.session.prompt,
        methods.agent.session.close,
        methods.agent.session.delete,
        methods.agent.logout,
        // Custom (pre-stabilization) methods routed through extMethod.
        'deleteSession',
        'renameSession',
        'getAccountInfo',
      ];
      for (const method of requestMethods) {
        try {
          await ctx.request(method, {});
        } catch (e) {
          if ((e as { code?: number })?.code === METHOD_NOT_FOUND) {
            notFound.push(method);
          }
        }
      }
      // Notification (no response): drive it so the handler runs.
      await ctx.notify(methods.agent.session.cancel, { sessionId: 's1' });
    });

    // No ACP method may be unregistered.
    expect(notFound).toEqual([]);

    // extMethod fields the three custom methods with the method name first
    // (their passthrough parser accepts any params, so routing always lands).
    expect(impl.extMethod).toHaveBeenCalledTimes(3);
    expect(impl.extMethod.mock.calls.map((c) => c[0])).toEqual([
      'deleteSession',
      'renameSession',
      'getAccountInfo',
    ]);

    // The cancel notification reached its handler.
    expect(impl.cancel).toHaveBeenCalledTimes(1);

    // Every handler captures the outbound channel from its context.
    expect(impl.captureChannel).toHaveBeenCalled();
  });
});
