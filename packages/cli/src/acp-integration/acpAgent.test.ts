/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AgentSideConnection,
  InitializeRequest,
} from '@agentclientprotocol/sdk';
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

import { QwenAgent } from './acpAgent.js';

function makeAgent(overrides?: { setValue?: ReturnType<typeof vi.fn> }) {
  const setValue = overrides?.setValue ?? vi.fn();
  const settings = { merged: {}, setValue } as unknown as LoadedSettings;
  const config = {} as unknown as Config;
  const argv = {} as unknown as CliArgs;
  const connection = {} as unknown as AgentSideConnection;
  return { agent: new QwenAgent(config, settings, argv, connection), setValue };
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
