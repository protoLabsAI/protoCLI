/**
 * @license
 * Copyright 2026 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adapted from QwenLM/qwen-code PR #3441 test suite.
 */

import { describe, it, expect } from 'vitest';
import { computeApiTruncationIndex, isRealUserTurn } from './historyMapping.js';
import type { HistoryItem } from '../types.js';
import type { Content, Part } from '@google/genai';

function userContent(text: string): Content {
  return { role: 'user', parts: [{ text } as Part] };
}

function modelContent(text: string): Content {
  return { role: 'model', parts: [{ text } as Part] };
}

function functionResponseContent(): Content {
  return {
    role: 'user',
    parts: [
      {
        functionResponse: { name: 'tool', response: { result: 'ok' } },
      } as unknown as Part,
    ],
  };
}

function startupPair(): [Content, Content] {
  return [
    userContent('Environment context...'),
    modelContent('Got it. Thanks for the context!'),
  ];
}

function userItem(id: number, text = `prompt ${id}`): HistoryItem {
  return { type: 'user', id, text } as HistoryItem;
}

function geminiItem(id: number): HistoryItem {
  return { type: 'gemini', id, text: `response ${id}` } as HistoryItem;
}

describe('computeApiTruncationIndex', () => {
  it('returns 0 for empty API history', () => {
    const ui: HistoryItem[] = [userItem(1)];
    const api: Content[] = [];
    expect(computeApiTruncationIndex(ui, 1, api)).toBe(0);
  });

  describe('without startup context', () => {
    it('rewinds to the first user turn (keep nothing)', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(3),
        geminiItem(4),
      ];
      const api: Content[] = [
        userContent('prompt 1'),
        modelContent('response 1'),
        userContent('prompt 3'),
        modelContent('response 3'),
      ];
      expect(computeApiTruncationIndex(ui, 1, api)).toBe(0);
    });

    it('rewinds to the second user turn (keep first turn)', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(3),
        geminiItem(4),
      ];
      const api: Content[] = [
        userContent('prompt 1'),
        modelContent('response 1'),
        userContent('prompt 3'),
        modelContent('response 3'),
      ];
      expect(computeApiTruncationIndex(ui, 3, api)).toBe(2);
    });

    it('rewinds to the third user turn', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(3),
        geminiItem(4),
        userItem(5),
        geminiItem(6),
      ];
      const api: Content[] = [
        userContent('prompt 1'),
        modelContent('response 1'),
        userContent('prompt 3'),
        modelContent('response 3'),
        userContent('prompt 5'),
        modelContent('response 5'),
      ];
      expect(computeApiTruncationIndex(ui, 5, api)).toBe(4);
    });
  });

  describe('with startup context pair', () => {
    it('keeps startup context when rewinding to the first turn', () => {
      const ui: HistoryItem[] = [userItem(1), geminiItem(2)];
      const api: Content[] = [
        ...startupPair(),
        userContent('prompt 1'),
        modelContent('response 1'),
      ];
      expect(computeApiTruncationIndex(ui, 1, api)).toBe(2);
    });

    it('keeps startup + first turn when rewinding to second turn', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(3),
        geminiItem(4),
      ];
      const api: Content[] = [
        ...startupPair(),
        userContent('prompt 1'),
        modelContent('response 1'),
        userContent('prompt 3'),
        modelContent('response 3'),
      ];
      expect(computeApiTruncationIndex(ui, 3, api)).toBe(4);
    });
  });

  describe('with tool call entries (functionResponse)', () => {
    it('skips functionResponse entries when counting user prompts', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(5),
        geminiItem(6),
      ];
      const api: Content[] = [
        userContent('prompt 1'),
        modelContent('response with tool call'),
        functionResponseContent(),
        modelContent('response after tool'),
        userContent('prompt 5'),
        modelContent('response 5'),
      ];
      expect(computeApiTruncationIndex(ui, 5, api)).toBe(4);
    });
  });

  describe('compression fallback', () => {
    it('returns -1 when not enough user prompts found', () => {
      const ui: HistoryItem[] = [
        userItem(1),
        geminiItem(2),
        userItem(3),
        geminiItem(4),
        userItem(5),
        geminiItem(6),
      ];
      const api: Content[] = [
        modelContent('compressed summary'),
        userContent('prompt 5'),
        modelContent('response 5'),
      ];
      expect(computeApiTruncationIndex(ui, 5, api)).toBe(-1);
    });
  });

  describe('with slash-command items in UI history', () => {
    it('ignores slash-command items when counting user turns', () => {
      const ui: HistoryItem[] = [
        userItem(1, '/help'),
        userItem(2, 'real prompt'),
        geminiItem(3),
        userItem(4, 'second real prompt'),
        geminiItem(5),
      ];
      const api: Content[] = [
        userContent('real prompt'),
        modelContent('response'),
        userContent('second real prompt'),
        modelContent('second response'),
      ];
      // Slash command at id=1 doesn't count. Rewinding to id=4 means 1 real
      // user turn precedes it → API truncate index = 2.
      expect(computeApiTruncationIndex(ui, 4, api)).toBe(2);
    });
  });
});

describe('isRealUserTurn', () => {
  it('returns true for plain text user items', () => {
    expect(isRealUserTurn(userItem(1, 'hello'))).toBe(true);
  });

  it('returns false for slash-command user items', () => {
    expect(isRealUserTurn(userItem(1, '/help'))).toBe(false);
    expect(isRealUserTurn(userItem(2, '/stats'))).toBe(false);
  });

  it('returns false for `?`-prefixed (help) user items', () => {
    expect(isRealUserTurn(userItem(1, '?'))).toBe(false);
  });

  it('returns false for non-user items', () => {
    expect(isRealUserTurn(geminiItem(1))).toBe(false);
  });

  it('returns false for empty user items', () => {
    expect(
      isRealUserTurn({ type: 'user', id: 1, text: '' } as HistoryItem),
    ).toBe(false);
  });
});
