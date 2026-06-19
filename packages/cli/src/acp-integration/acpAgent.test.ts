/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InitializeRequest } from '@agentclientprotocol/sdk';
import type { Config } from '@qwen-code/qwen-code-core';
import type { LoadedSettings } from '../config/settings.js';
import { SettingScope } from '../config/settings.js';
import type { CliArgs } from '../config/config.js';

// Mock the runtime-output-dir wrapper to just run the callback (no fs/context).
vi.mock('./runtimeOutputDirContext.js', () => ({
  runWithAcpRuntimeOutputDir: vi.fn(
    async (_settings: unknown, _cwd: unknown, fn: () => unknown) => fn(),
  ),
}));

// Mock core's SessionService so deleteSession doesn't touch disk.
const removeSessionMock = vi.fn().mockResolvedValue(true);
vi.mock('@qwen-code/qwen-code-core', async () => {
  const actual = await vi.importActual('@qwen-code/qwen-code-core');
  return {
    ...actual,
    SessionService: vi.fn().mockImplementation(() => ({
      removeSession: removeSessionMock,
    })),
  };
});

import { QwenAgent, installAcpShutdown } from './acpAgent.js';

function makeAgent(overrides?: { setValue?: ReturnType<typeof vi.fn> }) {
  const setValue = overrides?.setValue ?? vi.fn();
  const settings = { merged: {}, setValue } as unknown as LoadedSettings;
  const config = {} as unknown as Config;
  const argv = {} as unknown as CliArgs;
  return { agent: new QwenAgent(config, settings, argv), setValue };
}

describe('QwenAgent — first-class session lifecycle (ACP 0.25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeSessionMock.mockResolvedValue(true);
  });

  describe('initialize', () => {
    it('advertises the stabilized session + auth capabilities', async () => {
      const { agent } = makeAgent();
      const response = await agent.initialize({
        clientCapabilities: {},
      } as InitializeRequest);

      const caps = response.agentCapabilities;
      if (!caps) throw new Error('agentCapabilities should be present');
      expect(caps.sessionCapabilities).toMatchObject({
        list: {},
        resume: {},
        close: {},
        delete: {},
      });
      expect(caps.auth).toMatchObject({ logout: {} });
      expect(caps.loadSession).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears the persisted auth selection', async () => {
      const { agent, setValue } = makeAgent();
      const result = await agent.logout({});
      expect(result).toEqual({});
      expect(setValue).toHaveBeenCalledWith(
        SettingScope.User,
        'security.auth.selectedType',
        undefined,
      );
    });
  });

  describe('closeSession', () => {
    it('is lenient and returns {} for an unknown session', async () => {
      const { agent } = makeAgent();
      const result = await agent.closeSession({ sessionId: 'does-not-exist' });
      expect(result).toEqual({});
    });

    it('frees an idle session even though there is nothing to cancel', async () => {
      const { agent } = makeAgent();
      // An idle session's cancelPendingPrompt() throws "Not currently
      // generating"; close must swallow that and still free the session.
      const cancelPendingPrompt = vi
        .fn()
        .mockRejectedValue(new Error('Not currently generating'));
      const sessions = (agent as unknown as { sessions: Map<string, unknown> })
        .sessions;
      sessions.set('idle-1', { cancelPendingPrompt });

      const result = await agent.closeSession({ sessionId: 'idle-1' });

      expect(result).toEqual({});
      expect(cancelPendingPrompt).toHaveBeenCalled();
      expect(sessions.has('idle-1')).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('removes the stored session and returns {}', async () => {
      const { agent } = makeAgent();
      const result = await agent.deleteSession({ sessionId: 'sess-123' });
      expect(result).toEqual({});
      expect(removeSessionMock).toHaveBeenCalledWith('sess-123');
    });
  });
});

describe('installAcpShutdown — orphan/leak teardown', () => {
  function wire(closed: Promise<void> = new Promise<void>(() => {})) {
    const signals: Record<string, () => void> = {};
    const stdinEvents: Record<string, () => void> = {};
    const pendingTimers: Array<() => void> = [];
    const exit = vi.fn();
    const destroyStdin = vi.fn();
    const destroyStdout = vi.fn();

    installAcpShutdown(
      { closed },
      {
        onSignal: (sig, fn) => {
          signals[sig] = fn;
        },
        stdin: {
          on: (ev: string, fn: () => void) => {
            stdinEvents[ev] = fn;
          },
          destroy: destroyStdin,
        } as never,
        stdout: { destroy: destroyStdout } as never,
        exit,
        setTimeoutFn: ((fn: () => void) => {
          pendingTimers.push(fn);
          return { unref() {} };
        }) as never,
        log: () => {},
      },
    );

    const flushTimers = () => pendingTimers.splice(0).forEach((t) => t());
    return {
      signals,
      stdinEvents,
      exit,
      destroyStdin,
      destroyStdout,
      flushTimers,
    };
  }

  it('SIGTERM destroys the streams then force-exits (no kill -9 needed)', () => {
    const h = wire();
    h.signals['SIGTERM']();
    expect(h.destroyStdin).toHaveBeenCalled();
    expect(h.destroyStdout).toHaveBeenCalled();
    expect(h.exit).not.toHaveBeenCalled(); // deferred to the flush timer
    h.flushTimers();
    expect(h.exit).toHaveBeenCalledWith(0);
  });

  it('exits when the client disconnects (stdin close)', () => {
    const h = wire();
    h.stdinEvents['close']();
    h.flushTimers();
    expect(h.exit).toHaveBeenCalledWith(0);
  });

  it('exits when the ACP connection closes', async () => {
    let resolveClosed!: () => void;
    const closed = new Promise<void>((r) => {
      resolveClosed = r;
    });
    const h = wire(closed);
    resolveClosed();
    await closed;
    await Promise.resolve(); // let the .then() microtask run
    h.flushTimers();
    expect(h.exit).toHaveBeenCalledWith(0);
  });

  it('exits even if the connection closes with an error', async () => {
    const closed: Promise<void> = Promise.reject(new Error('stream broke'));
    const h = wire(closed);
    await closed.catch(() => {});
    await Promise.resolve();
    h.flushTimers();
    expect(h.exit).toHaveBeenCalledWith(0);
  });

  it('is idempotent — repeated signals tear down and exit exactly once', () => {
    const h = wire();
    h.signals['SIGTERM']();
    h.signals['SIGINT']();
    h.stdinEvents['close']();
    h.flushTimers();
    expect(h.destroyStdin).toHaveBeenCalledTimes(1);
    expect(h.exit).toHaveBeenCalledTimes(1);
  });
});
