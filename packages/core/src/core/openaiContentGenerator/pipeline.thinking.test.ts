/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Mock } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type OpenAI from 'openai';
import type { GenerateContentParameters } from '@google/genai';
import { GenerateContentResponse, FinishReason } from '@google/genai';

// Capture span calls so individual tests can assert on them. The mock is
// hoisted by Vitest, so we expose a getter that resolves at test time.
const captured = {
  attributes: {} as Record<string, unknown>,
  events: [] as Array<{ name: string; data?: Record<string, unknown> }>,
};

const resetCaptured = () => {
  captured.attributes = {};
  captured.events = [];
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startSpan: () => ({
        setAttribute: (key: string, value: unknown) => {
          captured.attributes[key] = value;
        },
        setAttributes: (attrs: Record<string, unknown>) => {
          Object.assign(captured.attributes, attrs);
        },
        addEvent: (name: string, data?: Record<string, unknown>) => {
          captured.events.push({ name, data });
        },
        setStatus: vi.fn(),
        end: vi.fn(),
      }),
    }),
  },
  SpanKind: { CLIENT: 'CLIENT', INTERNAL: 'INTERNAL' },
  SpanStatusCode: { OK: 'OK', ERROR: 'ERROR' },
  context: { active: () => ({}) },
}));

vi.mock('./converter.js');
vi.mock('openai');

import type { PipelineConfig } from './pipeline.js';
import { ContentGenerationPipeline } from './pipeline.js';
import { OpenAIContentConverter } from './converter.js';
import type { Config } from '../../config/config.js';
import type { ContentGeneratorConfig, AuthType } from '../contentGenerator.js';
import type { OpenAICompatibleProvider } from './provider/index.js';
import type { ErrorHandler } from './errorHandler.js';

describe('ContentGenerationPipeline — reasoning telemetry', () => {
  let pipeline: ContentGenerationPipeline;
  let mockClient: OpenAI;
  let mockConverter: OpenAIContentConverter;

  const buildPipeline = (logPrompts: boolean) => {
    const cliConfig = {
      getTelemetryLogPromptsEnabled: () => logPrompts,
    } as unknown as Config;

    mockClient = {
      chat: { completions: { create: vi.fn() } },
    } as unknown as OpenAI;

    mockConverter = {
      setModel: vi.fn(),
      setModalities: vi.fn(),
      convertGeminiRequestToOpenAI: vi.fn().mockReturnValue([]),
      convertOpenAIResponseToGemini: vi.fn(),
      convertOpenAIChunkToGemini: vi.fn(),
      convertGeminiToolsToOpenAI: vi.fn(),
      createStreamContext: vi.fn().mockReturnValue({
        toolCallParser: {
          addChunk: vi.fn(),
          getCompletedToolCalls: vi.fn().mockReturnValue([]),
          hasIncompleteToolCalls: vi.fn().mockReturnValue(false),
        },
        thinkBuffer: '',
        inThinkTag: false,
      }),
    } as unknown as OpenAIContentConverter;

    (OpenAIContentConverter as unknown as Mock).mockImplementation(
      () => mockConverter,
    );

    const provider: OpenAICompatibleProvider = {
      buildClient: vi.fn().mockReturnValue(mockClient),
      buildRequest: vi.fn().mockImplementation((req) => req),
      buildHeaders: vi.fn().mockReturnValue({}),
      getDefaultGenerationConfig: vi.fn().mockReturnValue({}),
    } as unknown as OpenAICompatibleProvider;

    const errorHandler: ErrorHandler = {
      handle: vi.fn().mockImplementation((e: unknown) => {
        throw e;
      }),
      shouldSuppressErrorLogging: vi.fn().mockReturnValue(false),
    } as unknown as ErrorHandler;

    const contentGeneratorConfig = {
      model: 'test-model',
      authType: 'openai' as AuthType,
    } as ContentGeneratorConfig;

    const config: PipelineConfig = {
      cliConfig,
      provider,
      contentGeneratorConfig,
      errorHandler,
    };

    return new ContentGenerationPipeline(config);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetCaptured();
  });

  describe('streaming', () => {
    const runStream = async (
      chunks: OpenAI.Chat.ChatCompletionChunk[],
      converted: GenerateContentResponse[],
    ) => {
      const stream = {
        async *[Symbol.asyncIterator]() {
          for (const c of chunks) yield c;
        },
      };
      (mockConverter.convertOpenAIChunkToGemini as Mock).mockImplementation(
        () => converted.shift(),
      );
      (mockClient.chat.completions.create as Mock).mockResolvedValue(stream);

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [{ parts: [{ text: 'hi' }], role: 'user' }],
      };
      const gen = await pipeline.executeStream(request, 'prompt-id');
      for await (const _ of gen) {
        // drain
      }
    };

    it('sets gen_ai.response.thinking from delta.reasoning_content when logPrompts=true', async () => {
      pipeline = buildPipeline(true);

      const chunks: OpenAI.Chat.ChatCompletionChunk[] = [
        {
          id: 'c1',
          choices: [
            {
              index: 0,
              delta: {
                reasoning_content: 'Let me think about ',
              } as unknown as OpenAI.Chat.ChatCompletionChunk.Choice.Delta,
              finish_reason: null as unknown as 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
        {
          id: 'c2',
          choices: [
            {
              index: 0,
              delta: {
                reasoning_content: 'this carefully.',
              } as unknown as OpenAI.Chat.ChatCompletionChunk.Choice.Delta,
              finish_reason: null as unknown as 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
        {
          id: 'c3',
          choices: [
            {
              index: 0,
              delta: { content: 'Answer.' },
              finish_reason: 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
      ];

      const finishResp = new GenerateContentResponse();
      finishResp.candidates = [
        {
          content: { parts: [{ text: 'Answer.' }], role: 'model' },
          finishReason: FinishReason.STOP,
        },
      ];
      finishResp.usageMetadata = {
        promptTokenCount: 5,
        candidatesTokenCount: 1,
        totalTokenCount: 6,
        thoughtsTokenCount: 4,
      };

      // Two empty thought-only chunks (filtered) + one finish chunk that yields.
      const converted = [
        new GenerateContentResponse(),
        new GenerateContentResponse(),
        finishResp,
      ];
      converted[0].candidates = [{ content: { parts: [], role: 'model' } }];
      converted[1].candidates = [{ content: { parts: [], role: 'model' } }];

      await runStream(chunks, converted);

      expect(captured.attributes['gen_ai.response.thinking']).toBe(
        'Let me think about this carefully.',
      );
      expect(captured.attributes['gen_ai.usage.thinking_tokens']).toBe(4);
    });

    it('falls back to delta.reasoning when reasoning_content is absent', async () => {
      pipeline = buildPipeline(true);

      const chunks: OpenAI.Chat.ChatCompletionChunk[] = [
        {
          id: 'c1',
          choices: [
            {
              index: 0,
              delta: {
                reasoning: 'alternate field',
              } as unknown as OpenAI.Chat.ChatCompletionChunk.Choice.Delta,
              finish_reason: 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
      ];
      const finishResp = new GenerateContentResponse();
      finishResp.candidates = [
        {
          content: { parts: [], role: 'model' },
          finishReason: FinishReason.STOP,
        },
      ];
      finishResp.usageMetadata = {
        promptTokenCount: 1,
        candidatesTokenCount: 0,
        totalTokenCount: 1,
      };

      await runStream(chunks, [finishResp]);

      expect(captured.attributes['gen_ai.response.thinking']).toBe(
        'alternate field',
      );
    });

    it('omits gen_ai.response.thinking when logPrompts is disabled', async () => {
      pipeline = buildPipeline(false);

      const chunks: OpenAI.Chat.ChatCompletionChunk[] = [
        {
          id: 'c1',
          choices: [
            {
              index: 0,
              delta: {
                reasoning_content: 'sensitive thoughts',
              } as unknown as OpenAI.Chat.ChatCompletionChunk.Choice.Delta,
              finish_reason: 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
      ];
      const finishResp = new GenerateContentResponse();
      finishResp.candidates = [
        {
          content: { parts: [], role: 'model' },
          finishReason: FinishReason.STOP,
        },
      ];
      finishResp.usageMetadata = {
        promptTokenCount: 1,
        candidatesTokenCount: 0,
        totalTokenCount: 1,
        thoughtsTokenCount: 7,
      };

      await runStream(chunks, [finishResp]);

      expect(captured.attributes['gen_ai.response.thinking']).toBeUndefined();
      // Token count is numeric → still emitted regardless of logPrompts.
      expect(captured.attributes['gen_ai.usage.thinking_tokens']).toBe(7);
    });

    it('truncates very long reasoning to 10K chars with marker', async () => {
      pipeline = buildPipeline(true);

      const longText = 'x'.repeat(11_000);
      const chunks: OpenAI.Chat.ChatCompletionChunk[] = [
        {
          id: 'c1',
          choices: [
            {
              index: 0,
              delta: {
                reasoning_content: longText,
              } as unknown as OpenAI.Chat.ChatCompletionChunk.Choice.Delta,
              finish_reason: 'stop',
            },
          ],
        } as OpenAI.Chat.ChatCompletionChunk,
      ];
      const finishResp = new GenerateContentResponse();
      finishResp.candidates = [
        {
          content: { parts: [], role: 'model' },
          finishReason: FinishReason.STOP,
        },
      ];
      finishResp.usageMetadata = {
        promptTokenCount: 1,
        candidatesTokenCount: 0,
        totalTokenCount: 1,
      };

      await runStream(chunks, [finishResp]);

      const value = captured.attributes['gen_ai.response.thinking'] as string;
      expect(value).toMatch(/\.\.\.\[truncated\]$/);
      expect(value.length).toBe(10_000 + '...[truncated]'.length);
    });
  });

  describe('non-streaming', () => {
    it('sets gen_ai.response.thinking from {thought:true} parts on response', async () => {
      pipeline = buildPipeline(true);

      const response = new GenerateContentResponse();
      response.candidates = [
        {
          content: {
            parts: [
              { text: 'reasoning step', thought: true },
              { text: 'final answer' },
            ],
            role: 'model',
          },
          finishReason: FinishReason.STOP,
        },
      ];
      response.usageMetadata = {
        promptTokenCount: 3,
        candidatesTokenCount: 2,
        totalTokenCount: 5,
        thoughtsTokenCount: 1,
      };

      (mockConverter.convertOpenAIResponseToGemini as Mock).mockReturnValue(
        response,
      );
      (mockClient.chat.completions.create as Mock).mockResolvedValue({
        id: 'r1',
        choices: [],
      } as unknown as OpenAI.Chat.ChatCompletion);

      const request: GenerateContentParameters = {
        model: 'test-model',
        contents: [{ parts: [{ text: 'q' }], role: 'user' }],
      };
      await pipeline.execute(request, 'prompt-id');

      expect(captured.attributes['gen_ai.response.thinking']).toBe(
        'reasoning step',
      );
      expect(captured.attributes['gen_ai.usage.thinking_tokens']).toBe(1);

      // Completion event should NOT include the thought text.
      const completionEvent = captured.events.find(
        (e) => e.name === 'gen_ai.content.completion',
      );
      expect(completionEvent?.data?.['gen_ai.completion']).toBe('final answer');
    });
  });
});
