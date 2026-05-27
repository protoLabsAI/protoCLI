/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { evaluateGoal, parseEvaluatorJson } from './goalEvaluator.js';
import type { ContentGenerator } from '../core/contentGenerator.js';

function mockGenerator(
  textResponse: string,
  tokens: number = 42,
): ContentGenerator {
  return {
    generateContent: vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: textResponse }] } }],
      usageMetadata: { totalTokenCount: tokens },
    }),
    generateContentStream: vi.fn(),
    countTokens: vi.fn(),
    embedContent: vi.fn(),
    useSummarizedThinking: () => false,
  } as unknown as ContentGenerator;
}

describe('parseEvaluatorJson', () => {
  it('parses a clean JSON object', () => {
    const r = parseEvaluatorJson('{"met": true, "reason": "all tests pass"}');
    expect(r.met).toBe(true);
    expect(r.reason).toBe('all tests pass');
  });

  it('strips surrounding code fences', () => {
    const r = parseEvaluatorJson(
      '```json\n{"met": false, "reason": "tests still failing"}\n```',
    );
    expect(r.met).toBe(false);
    expect(r.reason).toBe('tests still failing');
  });

  it('extracts JSON when prose surrounds the object', () => {
    const r = parseEvaluatorJson(
      'Sure -- {"met": true, "reason": "done"} -- end',
    );
    expect(r.met).toBe(true);
  });

  it('returns met=false on non-JSON responses', () => {
    const r = parseEvaluatorJson('I have no idea, sorry.');
    expect(r.met).toBe(false);
    expect(r.reason).toMatch(/not valid JSON/);
  });

  it('handles missing reason by supplying a default', () => {
    const r = parseEvaluatorJson('{"met": true}');
    expect(r.met).toBe(true);
    expect(r.reason).toBe('Condition met.');
  });

  it('treats truthy non-true values as not met', () => {
    const r = parseEvaluatorJson('{"met": "yes", "reason": "fuzzy"}');
    expect(r.met).toBe(false);
  });

  it('parses an impossible verdict when not met', () => {
    const r = parseEvaluatorJson(
      '{"met": false, "impossible": true, "reason": "condition is self-contradictory"}',
    );
    expect(r.met).toBe(false);
    expect(r.impossible).toBe(true);
    expect(r.reason).toBe('condition is self-contradictory');
  });

  it('ignores impossible when the condition is met', () => {
    const r = parseEvaluatorJson(
      '{"met": true, "impossible": true, "reason": "contradictory reply"}',
    );
    expect(r.met).toBe(true);
    expect(r.impossible).toBeUndefined();
  });

  it('omits impossible when absent or false', () => {
    expect(
      parseEvaluatorJson('{"met": false, "reason": "still working"}')
        .impossible,
    ).toBeUndefined();
    expect(
      parseEvaluatorJson(
        '{"met": false, "impossible": false, "reason": "still working"}',
      ).impossible,
    ).toBeUndefined();
  });

  it('handles braces inside JSON string values', () => {
    const r = parseEvaluatorJson(
      '{"met": true, "reason": "see {artifact} for proof"}',
    );
    expect(r.met).toBe(true);
    expect(r.reason).toBe('see {artifact} for proof');
  });

  it('handles escaped quotes inside JSON string values', () => {
    const r = parseEvaluatorJson(
      '{"met": false, "reason": "expected \\"PASS\\" but got \\"FAIL\\""}',
    );
    expect(r.met).toBe(false);
    expect(r.reason).toBe('expected "PASS" but got "FAIL"');
  });

  it('handles fenced blocks with a language tag and trailing prose', () => {
    const r = parseEvaluatorJson(
      'Here is my answer:\n```json\n{"met": true, "reason": "done"}\n```\nThat is all.',
    );
    expect(r.met).toBe(true);
    expect(r.reason).toBe('done');
  });

  it('does not hang on pathological whitespace input', () => {
    // Regression test for the ReDoS finding -- a pathological string that
    // used to make the old regex backtrack should now return quickly.
    const pathological = '```' + ' '.repeat(10_000);
    const start = Date.now();
    const r = parseEvaluatorJson(pathological);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(r.met).toBe(false);
  });
});

describe('evaluateGoal', () => {
  const ctx = {
    condition: 'all tests pass',
    toolCallSummary: 'npm test -> exit 0',
    lastAssistantMessage: 'Tests are passing.',
  };

  it('returns met=true when the model says so', async () => {
    const gen = mockGenerator('{"met": true, "reason": "tests passed"}', 100);
    const r = await evaluateGoal(gen, 'haiku', ctx);
    expect(r.met).toBe(true);
    expect(r.reason).toBe('tests passed');
    expect(r.tokensUsed).toBe(100);
  });

  it('returns met=false when the model says so', async () => {
    const gen = mockGenerator(
      '{"met": false, "reason": "tests still red"}',
      55,
    );
    const r = await evaluateGoal(gen, 'haiku', ctx);
    expect(r.met).toBe(false);
    expect(r.reason).toBe('tests still red');
  });

  it('returns met=false on empty response', async () => {
    const gen = mockGenerator('', 0);
    const r = await evaluateGoal(gen, 'haiku', ctx);
    expect(r.met).toBe(false);
    expect(r.reason).toMatch(/empty/);
  });

  it('returns met=false when the generator throws', async () => {
    const gen = {
      generateContent: vi.fn().mockRejectedValue(new Error('network down')),
      generateContentStream: vi.fn(),
      countTokens: vi.fn(),
      embedContent: vi.fn(),
      useSummarizedThinking: () => false,
    } as unknown as ContentGenerator;
    const r = await evaluateGoal(gen, 'haiku', ctx);
    expect(r.met).toBe(false);
    expect(r.reason).toMatch(/failed/);
  });

  it('honours an aborted signal as a cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const gen = {
      generateContent: vi
        .fn()
        .mockRejectedValue(new DOMException('aborted', 'AbortError')),
      generateContentStream: vi.fn(),
      countTokens: vi.fn(),
      embedContent: vi.fn(),
      useSummarizedThinking: () => false,
    } as unknown as ContentGenerator;
    const r = await evaluateGoal(gen, 'haiku', ctx, controller.signal);
    expect(r.met).toBe(false);
    expect(r.reason).toMatch(/cancel/i);
  });
});
