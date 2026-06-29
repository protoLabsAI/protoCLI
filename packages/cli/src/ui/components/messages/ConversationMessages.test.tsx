/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import {
  AssistantMessage,
  AssistantMessageContent,
  ThinkMessage,
  ThinkMessageContent,
  ThoughtExpansionContext,
} from './ConversationMessages.js';

describe('AssistantMessage', () => {
  it('renders the ⟡ prefix with prose', () => {
    const { lastFrame } = render(
      <AssistantMessage
        text="Here you go."
        isPending={false}
        contentWidth={80}
      />,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('⟡');
    expect(output).toContain('Here you go.');
  });

  it('renders nothing for an empty (tools-only) turn', () => {
    const { lastFrame } = render(
      <AssistantMessage text="" isPending={false} contentWidth={80} />,
    );
    expect((lastFrame() ?? '').trim()).toBe('');
  });

  it('renders nothing for whitespace-only text', () => {
    const { lastFrame } = render(
      <AssistantMessageContent
        text={'   \n  '}
        isPending={false}
        contentWidth={80}
      />,
    );
    expect((lastFrame() ?? '').trim()).toBe('');
  });
});

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

  it('renders the full thought in place once the stream finalizes (default)', () => {
    const text = 'reasoning '.repeat(10).trim(); // 99 chars
    const { lastFrame } = render(
      <ThinkMessage text={text} isPending={false} contentWidth={80} />,
    );
    const output = lastFrame() ?? '';
    // Reasoning stays visible inline; no collapse to the summary.
    expect(output).toContain('reasoning reasoning');
    expect(output).not.toContain('thinking (');
  });

  it('collapses to "thinking (N chars)" only when expansion is disabled', () => {
    const text = 'reasoning '.repeat(10).trim(); // 99 chars
    const { lastFrame } = render(
      <ThoughtExpansionContext.Provider value={false}>
        <ThinkMessage text={text} isPending={false} contentWidth={80} />
      </ThoughtExpansionContext.Provider>,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('▸');
    expect(output).toContain(`thinking (${text.length} chars)`);
    expect(output).not.toContain('reasoning reasoning');
  });

  it('formats large char counts with thousands separator when collapsed', () => {
    const text = 'x'.repeat(12_345);
    const { lastFrame } = render(
      <ThoughtExpansionContext.Provider value={false}>
        <ThinkMessage text={text} isPending={false} contentWidth={80} />
      </ThoughtExpansionContext.Provider>,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('thinking (12,345 chars)');
  });

  it('expands the full thought (no summary) inside an expanded context', () => {
    const { lastFrame } = render(
      <ThoughtExpansionContext.Provider value={true}>
        <ThinkMessage
          text="Let me weigh the tradeoffs before deciding."
          isPending={false}
          contentWidth={80}
        />
      </ThoughtExpansionContext.Provider>,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('Let me weigh the tradeoffs');
    expect(output).not.toContain('thinking (');
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

  it('renders the continuation in place once finalized (default)', () => {
    const { lastFrame } = render(
      <ThinkMessageContent
        text="continued reasoning text"
        isPending={false}
        contentWidth={80}
      />,
    );
    expect(lastFrame() ?? '').toContain('continued reasoning text');
  });

  it('renders nothing once finalized only when expansion is disabled', () => {
    const { lastFrame } = render(
      <ThoughtExpansionContext.Provider value={false}>
        <ThinkMessageContent
          text="continued reasoning text"
          isPending={false}
          contentWidth={80}
        />
      </ThoughtExpansionContext.Provider>,
    );
    expect((lastFrame() ?? '').trim()).toBe('');
  });

  it('renders the finalized continuation inside an expanded context', () => {
    const { lastFrame } = render(
      <ThoughtExpansionContext.Provider value={true}>
        <ThinkMessageContent
          text="continued reasoning text"
          isPending={false}
          contentWidth={80}
        />
      </ThoughtExpansionContext.Provider>,
    );
    expect(lastFrame() ?? '').toContain('continued reasoning text');
  });
});
