/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { ThinkMessage, ThinkMessageContent } from './ConversationMessages.js';

describe('ThinkMessage', () => {
  it('renders the streaming text expanded while pending', () => {
    const { lastFrame } = render(
      <ThinkMessage
        text="Let me consider this carefully and weigh the options."
        isPending={true}
        contentWidth={80}
      />,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('Let me consider this');
    // Streaming render uses the existing ⟡ glyph, not the ▸ summary marker.
    expect(output).toContain('⟡');
    expect(output).not.toContain('thinking (');
  });

  it('renders compact "thinking (N chars)" summary once stream finalizes', () => {
    const text = 'reasoning '.repeat(10).trim(); // 99 chars
    const { lastFrame } = render(
      <ThinkMessage text={text} isPending={false} contentWidth={80} />,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('▸');
    expect(output).toContain(`thinking (${text.length} chars)`);
    // Underlying reasoning text is not rendered inline post-stream.
    expect(output).not.toContain('reasoning reasoning');
  });

  it('formats large char counts with thousands separator', () => {
    const text = 'x'.repeat(12_345);
    const { lastFrame } = render(
      <ThinkMessage text={text} isPending={false} contentWidth={80} />,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('thinking (12,345 chars)');
  });
});

describe('ThinkMessageContent', () => {
  it('renders the continuation text while pending', () => {
    const { lastFrame } = render(
      <ThinkMessageContent
        text="continued reasoning text"
        isPending={true}
        contentWidth={80}
      />,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('continued reasoning text');
  });

  it('renders nothing once stream finalizes (the parent ThinkMessage owns the summary)', () => {
    const { lastFrame } = render(
      <ThinkMessageContent
        text="continued reasoning text"
        isPending={false}
        contentWidth={80}
      />,
    );
    const output = lastFrame() ?? '';
    expect(output.trim()).toBe('');
  });
});
