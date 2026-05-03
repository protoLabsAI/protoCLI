/**
 * @license
 * Copyright 2026 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 *
 * Session-level wrapper around `generateRecap`. Callers that don't already
 * hold the conversation history (e.g. the auto-fire-on-return hook) want a
 * single function that pulls the latest history off the GeminiClient and
 * returns the polished recap. Returns null on empty / aborted / failed
 * generation; the auto-fire path treats that as "skip".
 *
 * Adapted from QwenLM/qwen-code's `services/sessionRecap.ts` (introduced in
 * #3434, refined in #3478/#3482) — the wrapper shape `{ text }` matches
 * upstream so the auto-fire hook can be ported without diverging.
 */

import type { Config } from '../config/config.js';
import { generateRecap } from '../recap/recapGenerator.js';

export async function generateSessionRecap(
  config: Config,
  abortSignal: AbortSignal,
): Promise<{ text: string } | null> {
  const geminiClient = config.getGeminiClient();
  if (!geminiClient) return null;

  const conversation = geminiClient.getHistory?.() ?? [];
  const hasModel = conversation.some((c) => c.role === 'model');
  const hasUser = conversation.some((c) => c.role === 'user');
  if (!hasModel || !hasUser) return null;

  const text = await generateRecap(config, conversation, abortSignal);
  if (!text) return null;
  return { text };
}
