/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Content } from '@google/genai';

vi.mock('./sessionMemory/index.js', () => ({
  extractSessionMemory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../memory/memoryExtractor.js', () => ({
  extractMemories: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./evolveService.js', () => ({
  runEvolvePass: vi.fn().mockResolvedValue(undefined),
}));

import { firePostTurnBackground } from './postTurnBackground.js';
import { extractSessionMemory } from './sessionMemory/index.js';
import { extractMemories } from '../memory/memoryExtractor.js';
import { runEvolvePass } from './evolveService.js';
import type { Config } from '../config/config.js';

const config = {} as Config;
const history: Content[] = [
  { role: 'user', parts: [{ text: 'add a multiply function' }] },
  { role: 'model', parts: [{ text: 'done' }] },
];

describe('firePostTurnBackground', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires all three post-turn passes with the expected args', () => {
    firePostTurnBackground(config, history, 20_000);
    expect(extractSessionMemory).toHaveBeenCalledWith(config, history, 20_000);
    expect(extractMemories).toHaveBeenCalledWith(config, 10, 'project');
    expect(runEvolvePass).toHaveBeenCalledWith(config, [
      { role: 'user', text: 'add a multiply function' },
      { role: 'model', text: 'done' },
    ]);
  });

  it('never throws even if a pass rejects (best-effort, fire-and-forget)', () => {
    vi.mocked(extractSessionMemory).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(extractMemories).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(runEvolvePass).mockRejectedValueOnce(new Error('boom'));
    expect(() => firePostTurnBackground(config, history, 0)).not.toThrow();
  });

  it('skips empty-text entries when building the evolve message window', () => {
    const withEmpty: Content[] = [
      { role: 'user', parts: [{ text: '' }] },
      { role: 'model', parts: [{ text: 'kept' }] },
    ];
    firePostTurnBackground(config, withEmpty, 1);
    expect(runEvolvePass).toHaveBeenCalledWith(config, [
      { role: 'model', text: 'kept' },
    ]);
  });
});
