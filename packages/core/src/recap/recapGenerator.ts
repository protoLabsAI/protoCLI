/**
 * @license
 * Copyright 2025 protoLabs Studio
 * SPDX-License-Identifier: Apache-2.0
 *
 * Recap Generator
 *
 * Generates a 1-3 sentence "where we left off" card after long agent turns.
 * Modeled on cc-2.18's awaySummary, but triggered by turn duration / tool count
 * rather than terminal blur.
 */

import type { Content } from '@google/genai';
import type { Config } from '../config/config.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('RECAP');

/** Last-N turns of conversation that get sent to the recap model. */
const RECENT_MESSAGE_WINDOW = 30;

/**
 * Preferred fast-model alias for recap generation. When this id is in the
 * user's configured providers, we route the recap to it instead of whatever
 * heavyweight model the main session is using. Falls back to the current
 * model with thinking disabled when not available.
 */
const PREFERRED_RECAP_MODEL_ID = 'protolabs/fast';

const RECAP_PROMPT = `That last agent turn was long. Summarize where we are so the user can pick back up cold.

Write exactly 1-3 short sentences. Lead with the high-level goal — what they're building or debugging, not implementation details. Then state the concrete current status or next step. No status reports, no commit recaps, no apologies.

Reply with ONLY the recap text — no headers, no quotes, no preamble.`;

/**
 * Decide which model to use for the recap. Prefers `protolabs/fast` if the
 * user has it configured (it's the gateway alias for a fast non-thinking
 * model). Falls back to the current session model — thinking is then
 * suppressed via `thinkingConfig.includeThoughts: false` which pipeline.ts
 * translates into `extra_body.enable_thinking: false` on the wire.
 */
function pickRecapModel(config: Config): {
  model: string;
  isOverride: boolean;
} {
  const available = config.getModelsConfig().getAllConfiguredModels();
  if (available.some((m) => m.id === PREFERRED_RECAP_MODEL_ID)) {
    return { model: PREFERRED_RECAP_MODEL_ID, isOverride: true };
  }
  return { model: config.getModel(), isOverride: false };
}

/**
 * Generates a short recap of recent conversation. Returns null on abort,
 * empty input, or any error (recap is best-effort and must not crash callers).
 */
export async function generateRecap(
  config: Config,
  conversationHistory: Content[],
  abortSignal: AbortSignal,
): Promise<string | null> {
  if (conversationHistory.length === 0) return null;

  try {
    const recent = conversationHistory.slice(-RECENT_MESSAGE_WINDOW);
    const contents: Content[] = [
      ...recent,
      { role: 'user', parts: [{ text: RECAP_PROMPT }] },
    ];

    const { model, isOverride } = pickRecapModel(config);

    const generator = config.getContentGenerator();
    const response = await generator.generateContent(
      {
        model,
        contents,
        config: {
          abortSignal,
          thinkingConfig: { includeThoughts: false },
          // Empty tools array (truthy) bypasses pipeline.ts buildRequest's
          // tool-stripping path. Without this, assistant turns containing
          // tool_calls — i.e. most of the agent's actual work — are dropped
          // before the request leaves, starving the recap of context.
          tools: [],
          // Opt into the model override path in the OpenAI pipeline. Pipeline
          // ignores request.model by default for safety; for recap we know the
          // alias resolves on the gateway, so honor it.
          ...(isOverride ? { allowModelOverride: true } : {}),
        } as Record<string, unknown>,
      },
      'recap',
    );

    const text = response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) return null;
    return text;
  } catch (error) {
    if (abortSignal.aborted) return null;
    debugLogger.warn(
      `[recap] generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
