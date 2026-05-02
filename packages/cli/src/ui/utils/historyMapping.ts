/**
 * @license
 * Copyright 2026 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adapted from QwenLM/qwen-code PR #3441 to fix our existing rewind feature's
 * LLM history truncation. The original implementation walked apiHistory by
 * `role === 'user'` count, which conflated:
 *   1. Real user prompts (what we want to count)
 *   2. Tool result entries (`role: 'user'` with `functionResponse` parts)
 *   3. The startup context pair (env preamble + "Got it" model ack)
 *   4. UI-only slash command items that never reached the API
 *
 * `computeApiTruncationIndex` correctly handles all four cases.
 */

import type { HistoryItem } from '../types.js';
import type { Content } from '@google/genai';

/**
 * Returns true when the history item represents a real user prompt that was
 * sent to the model, as opposed to a slash-command invocation (`/help`,
 * `/stats`, …) which is stored with `type: 'user'` in the UI but never
 * reaches the API history.
 */
export function isRealUserTurn(item: HistoryItem): boolean {
  if (item.type !== 'user' || !('text' in item) || !item.text) return false;
  return !item.text.startsWith('/') && !item.text.startsWith('?');
}

/**
 * The well-known startup context model acknowledgment text. Used to detect
 * whether the API history starts with the env preamble + ack pair so we can
 * skip past it when counting user turns.
 */
const STARTUP_CONTEXT_MODEL_ACK = 'Got it. Thanks for the context!';

/**
 * Distinguishes a real user text prompt from a tool result entry. Tool
 * results are stored with `role: 'user'` but contain `functionResponse`
 * parts; only entries with text content count as user turns.
 */
function isUserTextContent(content: Content): boolean {
  if (content.role !== 'user') return false;
  if (!content.parts || content.parts.length === 0) return false;

  const hasFunctionResponse = content.parts.some(
    (part) => 'functionResponse' in part,
  );
  if (hasFunctionResponse) return false;

  return content.parts.some((part) => 'text' in part && Boolean(part.text));
}

/**
 * Detects whether the API history starts with the startup context pair
 * `[user(env preamble), model("Got it…")]`.
 */
function hasStartupContext(apiHistory: Content[]): boolean {
  if (apiHistory.length < 2) return false;
  const first = apiHistory[0];
  const second = apiHistory[1];
  if (first?.role !== 'user' || second?.role !== 'model') return false;
  return (
    second.parts?.some(
      (part) => 'text' in part && part.text === STARTUP_CONTEXT_MODEL_ACK,
    ) ?? false
  );
}

/**
 * Computes the number of API Content[] entries to keep when rewinding to a
 * specific user turn in the UI history.
 *
 * Returns the API index to slice to (i.e., `apiHistory.slice(0, idx)`), or
 * `-1` when the target turn cannot be located — typically because earlier
 * turns were absorbed by chat compression. Callers should surface a
 * "cannot rewind to a compressed turn" error rather than truncating to an
 * incorrect index.
 *
 * @param uiHistory The full UI history array
 * @param targetUserItemId The ID of the user HistoryItem to rewind to
 * @param apiHistory The current API Content[] array
 */
export function computeApiTruncationIndex(
  uiHistory: HistoryItem[],
  targetUserItemId: number,
  apiHistory: Content[],
): number {
  // Count how many real user turns precede the target in the UI history.
  let uiUserTurnCount = 0;
  for (const item of uiHistory) {
    if (item.id === targetUserItemId) break;
    if (isRealUserTurn(item)) {
      uiUserTurnCount++;
    }
  }

  // Skip past the startup context pair when counting API user turns.
  const startIndex = hasStartupContext(apiHistory) ? 2 : 0;

  if (uiUserTurnCount === 0) {
    // Rewinding to the first user turn → keep only the startup context.
    return startIndex;
  }

  let realUserPromptCount = 0;
  for (let i = startIndex; i < apiHistory.length; i++) {
    if (isUserTextContent(apiHistory[i]!)) {
      realUserPromptCount++;
      // Truncate immediately before the target prompt.
      if (realUserPromptCount > uiUserTurnCount) {
        return i;
      }
    }
  }

  // Target turn is unreachable — likely absorbed by chat compression.
  return -1;
}
