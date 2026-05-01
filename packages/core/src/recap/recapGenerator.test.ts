/**
 * @license
 * Copyright 2025 protoLabs Studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { GenerateContentResponse } from '@google/genai';
import type { Config } from '../config/config.js';
import type { AvailableModel } from '../models/types.js';
import { generateRecap } from './recapGenerator.js';

describe('generateRecap — model selection', () => {
  let generateContent: Mock;
  let getModel: Mock;
  let getAllConfiguredModels: Mock;
  let mockConfig: Config;

  const buildResponse = (text: string): GenerateContentResponse => {
    const r = new GenerateContentResponse();
    r.candidates = [
      {
        content: { parts: [{ text }], role: 'model' },
        index: 0,
        safetyRatings: [],
      },
    ];
    return r;
  };

  beforeEach(() => {
    generateContent = vi.fn().mockResolvedValue(buildResponse('OK recap'));
    getModel = vi.fn().mockReturnValue('protolabs/smart');
    getAllConfiguredModels = vi.fn().mockReturnValue([]);
    mockConfig = {
      getContentGenerator: () => ({ generateContent }),
      getModel,
      getModelsConfig: () => ({ getAllConfiguredModels }),
    } as unknown as Config;
  });

  const fakeAvailable = (id: string): AvailableModel =>
    ({ id, label: id, authType: 'openai' as never }) as AvailableModel;

  it('routes to protolabs/fast and sets allowModelOverride when the alias is configured', async () => {
    getAllConfiguredModels.mockReturnValue([
      fakeAvailable('protolabs/smart'),
      fakeAvailable('protolabs/fast'),
      fakeAvailable('kimi-k2.6'),
    ]);

    const ac = new AbortController();
    await generateRecap(
      mockConfig,
      [{ role: 'user', parts: [{ text: 'hi' }] }],
      ac.signal,
    );

    expect(generateContent).toHaveBeenCalledTimes(1);
    const callArgs = generateContent.mock.calls[0][0] as {
      model: string;
      config: { allowModelOverride?: boolean };
    };
    expect(callArgs.model).toBe('protolabs/fast');
    expect(callArgs.config.allowModelOverride).toBe(true);
  });

  it('falls back to the current model and omits allowModelOverride when protolabs/fast is absent', async () => {
    getAllConfiguredModels.mockReturnValue([
      fakeAvailable('protolabs/smart'),
      fakeAvailable('kimi-k2.6'),
    ]);
    getModel.mockReturnValue('kimi-k2.6');

    const ac = new AbortController();
    await generateRecap(
      mockConfig,
      [{ role: 'user', parts: [{ text: 'hi' }] }],
      ac.signal,
    );

    const callArgs = generateContent.mock.calls[0][0] as {
      model: string;
      config: Record<string, unknown>;
    };
    expect(callArgs.model).toBe('kimi-k2.6');
    expect(callArgs.config['allowModelOverride']).toBeUndefined();
  });

  it('always sets thinkingConfig.includeThoughts=false (lets pipeline.ts inject extra_body.enable_thinking)', async () => {
    const ac = new AbortController();
    await generateRecap(
      mockConfig,
      [{ role: 'user', parts: [{ text: 'hi' }] }],
      ac.signal,
    );

    const callArgs = generateContent.mock.calls[0][0] as {
      config: { thinkingConfig?: { includeThoughts?: boolean } };
    };
    expect(callArgs.config.thinkingConfig?.includeThoughts).toBe(false);
  });
});
