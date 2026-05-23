/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import type { GoalEvaluationContext, GoalEvaluationResult } from './types.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('GOAL_EVALUATOR');

const EVALUATOR_INSTRUCTIONS = `You are judging whether a user's completion condition has been satisfied by an AI coding assistant.

You only see what the assistant has surfaced in the transcript -- tool calls it ran, their outcomes, and the final assistant message. You do not run commands yourself.

Respond ONLY with valid JSON matching exactly this schema:
{"met": boolean, "reason": "one short sentence explaining why"}

Rules:
- Set "met": true only when the condition is clearly demonstrated by the visible evidence (a test output, an exit code, a file count, an empty queue, etc.).
- If the assistant only claims the work is done without showing evidence, set "met": false and ask for the missing evidence in "reason".
- If the condition cannot be verified from what is shown, set "met": false and explain what would prove it in "reason".
- Keep "reason" to one short sentence. It will be shown to the assistant as guidance for the next turn.`;

/**
 * Evaluate whether a goal condition has been met, using the configured small
 * model. Returns "not met" with the failure reason on any error so the loop
 * stays safe -- callers can manually clear the goal if it gets stuck.
 */
export async function evaluateGoal(
  generator: ContentGenerator,
  model: string,
  context: GoalEvaluationContext,
  signal?: AbortSignal,
): Promise<GoalEvaluationResult> {
  const userPrompt = buildEvaluatorPrompt(context);

  try {
    const response = await generator.generateContent(
      {
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          abortSignal: signal,
          thinkingConfig: { includeThoughts: false },
          // tools: [] (truthy) bypasses tool-stripping in the request pipeline.
          tools: [],
          temperature: 0,
        },
      },
      'goal-evaluator',
    );

    const text = response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    const tokensUsed =
      response.usageMetadata?.totalTokenCount ??
      response.usageMetadata?.candidatesTokenCount ??
      0;

    if (!text) {
      return {
        met: false,
        reason: 'Evaluator returned an empty response; will retry next turn.',
        tokensUsed,
      };
    }

    const parsed = parseEvaluatorJson(text);
    return { ...parsed, tokensUsed };
  } catch (error) {
    if (signal?.aborted) {
      return { met: false, reason: 'Evaluation cancelled.', tokensUsed: 0 };
    }
    debugLogger.warn(
      `goal evaluator failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      met: false,
      reason: 'Evaluator call failed; continuing to next turn.',
      tokensUsed: 0,
    };
  }
}

function buildEvaluatorPrompt(context: GoalEvaluationContext): string {
  return [
    EVALUATOR_INSTRUCTIONS,
    '',
    'Condition:',
    context.condition,
    '',
    'Recent tool calls:',
    context.toolCallSummary || '(none)',
    '',
    'Final assistant message:',
    context.lastAssistantMessage || '(empty)',
  ].join('\n');
}

/**
 * Parse the evaluator response. Tolerates surrounding prose and code-fence
 * markers; falls back to a "not met" result if nothing parseable is found.
 */
export function parseEvaluatorJson(
  text: string,
): Pick<GoalEvaluationResult, 'met' | 'reason'> {
  const cleaned = stripCodeFence(text);
  const jsonObj = extractFirstJsonObject(cleaned);
  if (!jsonObj) {
    return {
      met: false,
      reason: `Evaluator response was not valid JSON; raw: ${truncate(text, 120)}`,
    };
  }

  try {
    const parsed = JSON.parse(jsonObj) as {
      met?: unknown;
      reason?: unknown;
    };
    const met = parsed.met === true;
    const reason =
      typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : met
          ? 'Condition met.'
          : 'No reason provided.';
    return { met, reason };
  } catch {
    return {
      met: false,
      reason: `Evaluator response was not valid JSON; raw: ${truncate(text, 120)}`,
    };
  }
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
