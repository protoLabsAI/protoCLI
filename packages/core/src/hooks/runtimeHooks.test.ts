/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookRegistry, type HookRegistryConfig } from './hookRegistry.js';
import { HookRunner } from './hookRunner.js';
import {
  HookEventName,
  HookType,
  HooksConfigSource,
  type HookConfig,
  type HookInput,
  type HookOutput,
} from './types.js';

vi.mock('./trustedHooks.js', () => ({
  TrustedHooksManager: vi.fn().mockImplementation(() => ({
    getUntrustedHooks: vi.fn().mockReturnValue([]),
    trustHooks: vi.fn(),
  })),
}));

function makeRegistryConfig(): HookRegistryConfig {
  return {
    getProjectRoot: () => '/test',
    isTrustedFolder: () => true,
    getHooks: () => undefined,
    getProjectHooks: () => undefined,
    getExtensions: () => [],
  };
}

function makeInput(): HookInput {
  return {
    session_id: 'sess',
    transcript_path: '/tmp/t',
    cwd: '/tmp',
    hook_event_name: HookEventName.PreToolUse,
    timestamp: new Date().toISOString(),
  };
}

describe('HookRegistry.addRuntimeHook', () => {
  let registry: HookRegistry;

  beforeEach(async () => {
    registry = new HookRegistry(makeRegistryConfig());
    await registry.initialize();
  });

  it('registers an SDK callback hook visible to getHooksForEvent', () => {
    registry.addRuntimeHook(HookEventName.PreToolUse, {
      type: HookType.SdkCallback,
      callbackId: 'cb-1',
      name: 'cb-1',
    });
    const entries = registry.getHooksForEvent(HookEventName.PreToolUse);
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe(HooksConfigSource.Runtime);
    expect(entries[0].config.type).toBe(HookType.SdkCallback);
  });

  it('returns a disposer that removes the hook', () => {
    const dispose = registry.addRuntimeHook(HookEventName.PreToolUse, {
      type: HookType.SdkCallback,
      callbackId: 'cb-2',
      name: 'cb-2',
    });
    dispose();
    expect(registry.getHooksForEvent(HookEventName.PreToolUse)).toHaveLength(0);
  });

  it('replaces a prior registration with the same name+event', () => {
    registry.addRuntimeHook(HookEventName.PreToolUse, {
      type: HookType.SdkCallback,
      callbackId: 'cb-3',
      name: 'cb-3',
    });
    registry.addRuntimeHook(HookEventName.PreToolUse, {
      type: HookType.SdkCallback,
      callbackId: 'cb-3-replaced',
      name: 'cb-3',
    });
    const entries = registry.getHooksForEvent(HookEventName.PreToolUse);
    expect(entries).toHaveLength(1);
    expect((entries[0].config as { callbackId: string }).callbackId).toBe(
      'cb-3-replaced',
    );
  });

  it('clearRuntimeHooks removes all runtime entries but leaves config-loaded ones', async () => {
    // Seed a config-loaded hook so we can verify it survives the clear.
    const cfg = makeRegistryConfig();
    cfg.getHooks = () => ({
      [HookEventName.PreToolUse]: [
        {
          hooks: [
            { type: HookType.Command, command: 'echo file', name: 'file-hook' },
          ],
        },
      ],
    });
    const r = new HookRegistry(cfg);
    await r.initialize();
    r.addRuntimeHook(HookEventName.PreToolUse, {
      type: HookType.SdkCallback,
      callbackId: 'runtime',
      name: 'runtime',
    });
    expect(r.getHooksForEvent(HookEventName.PreToolUse)).toHaveLength(2);
    r.clearRuntimeHooks();
    const remaining = r.getHooksForEvent(HookEventName.PreToolUse);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].source).not.toBe(HooksConfigSource.Runtime);
  });

  it('rejects an SdkCallback registration missing callbackId', () => {
    // The runtime path doesn't go through validateHookConfig, but the
    // config-loaded path does -- a missing callbackId in a settings file
    // should be discarded with a warning.
    const cfg = makeRegistryConfig();
    cfg.getHooks = () => ({
      [HookEventName.PreToolUse]: [
        {
          hooks: [
            {
              type: HookType.SdkCallback,
              name: 'broken',
              // missing callbackId
            } as unknown as HookConfig,
          ],
        },
      ],
    });
    const r = new HookRegistry(cfg);
    return r.initialize().then(() => {
      expect(r.getHooksForEvent(HookEventName.PreToolUse)).toHaveLength(0);
    });
  });
});

describe('HookRunner SdkCallback executor', () => {
  let runner: HookRunner;

  beforeEach(() => {
    runner = new HookRunner();
  });

  it('routes SdkCallback hooks through the registered invoker', async () => {
    const fakeOutput: HookOutput = {
      decision: 'allow',
      reason: 'looks fine',
    };
    const invoker = vi.fn().mockResolvedValue(fakeOutput);
    runner.setSdkCallbackInvoker(invoker);

    const input = makeInput();
    const result = await runner.executeHook(
      {
        type: HookType.SdkCallback,
        callbackId: 'cb-fire',
        name: 'cb-fire',
      },
      HookEventName.PreToolUse,
      input,
    );

    expect(invoker).toHaveBeenCalledTimes(1);
    expect(invoker).toHaveBeenCalledWith('cb-fire', input, null);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(fakeOutput);
  });

  it('forwards tool_use_id from PreToolUse input to the invoker', async () => {
    const invoker = vi.fn().mockResolvedValue(undefined);
    runner.setSdkCallbackInvoker(invoker);

    const input = {
      ...makeInput(),
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu-42',
      permission_mode: 'default',
    } as unknown as HookInput;

    await runner.executeHook(
      {
        type: HookType.SdkCallback,
        callbackId: 'cb-tool',
        name: 'cb-tool',
      },
      HookEventName.PreToolUse,
      input,
    );

    expect(invoker).toHaveBeenCalledWith('cb-tool', input, 'tu-42');
  });

  it('is a no-op success when no invoker is registered', async () => {
    const result = await runner.executeHook(
      {
        type: HookType.SdkCallback,
        callbackId: 'cb-orphan',
        name: 'cb-orphan',
      },
      HookEventName.PreToolUse,
      makeInput(),
    );
    expect(result.success).toBe(true);
    expect(result.output).toBeUndefined();
  });

  it('surfaces invoker errors as a failed execution result', async () => {
    runner.setSdkCallbackInvoker(async () => {
      throw new Error('host crashed');
    });
    const result = await runner.executeHook(
      {
        type: HookType.SdkCallback,
        callbackId: 'cb-boom',
        name: 'cb-boom',
      },
      HookEventName.PreToolUse,
      makeInput(),
    );
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('host crashed');
  });

  it('clearing the invoker reverts to no-op behaviour', async () => {
    const invoker = vi.fn().mockResolvedValue(undefined);
    runner.setSdkCallbackInvoker(invoker);
    runner.setSdkCallbackInvoker(undefined);

    await runner.executeHook(
      {
        type: HookType.SdkCallback,
        callbackId: 'cb-cleared',
        name: 'cb-cleared',
      },
      HookEventName.PreToolUse,
      makeInput(),
    );
    expect(invoker).not.toHaveBeenCalled();
  });
});
