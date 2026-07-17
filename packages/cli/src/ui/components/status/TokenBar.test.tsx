/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Box, Text } from 'ink';
import { TokenBar } from './TokenBar.js';
import { firstToken, tokens, type StatusToken } from './types.js';

const token = (key: string, label = key): StatusToken => ({
  key,
  node: <Text>{label}</Text>,
});

/**
 * Both real surfaces host the bar inside a row-flex Box; rendering it at the
 * Ink root instead would stack the tokens in a column.
 */
const renderBar = (items: StatusToken[], separator: React.ReactNode) =>
  render(
    <Box flexDirection="row">
      <TokenBar tokens={items} separator={separator} />
    </Box>,
  );

describe('tokens()', () => {
  it('keeps applicable tokens in declared order', () => {
    expect(
      tokens(token('a'), token('b'), token('c')).map((t) => t.key),
    ).toEqual(['a', 'b', 'c']);
  });

  it('drops every falsy form a builder can produce', () => {
    const result = tokens(token('a'), false, null, undefined, token('b'));
    expect(result.map((t) => t.key)).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing applies', () => {
    expect(tokens(false, null, undefined)).toEqual([]);
  });
});

describe('firstToken()', () => {
  it('returns the first applicable token, honouring declared priority', () => {
    expect(firstToken(false, token('b'), token('c'))?.key).toBe('b');
  });

  it('returns null when nothing applies', () => {
    expect(firstToken(false, null, undefined)).toBeNull();
  });

  it('does not let a later token outrank an earlier one', () => {
    expect(firstToken(token('high'), token('low'))?.key).toBe('high');
  });
});

describe('<TokenBar />', () => {
  const sep = <Text>{' | '}</Text>;

  it('interleaves separators between tokens', () => {
    const { lastFrame } = renderBar(
      tokens(token('a'), token('b'), token('c')),
      sep,
    );
    expect(lastFrame()).toBe('a | b | c');
  });

  it('draws no separator for a single token', () => {
    const { lastFrame } = renderBar(tokens(token('solo')), sep);
    expect(lastFrame()).toBe('solo');
  });

  it('renders nothing for an empty token array', () => {
    const { lastFrame } = renderBar([], sep);
    expect(lastFrame()).toBe('');
  });

  // The reason this component exists: separators are placed by position in the
  // rendered array, so an omitted token cannot strand a separator with nothing
  // on its left. Placing them by source-order index is what breaks here.
  it('leaves no dangling separator when a leading token is omitted', () => {
    const { lastFrame } = renderBar(tokens(false, token('b'), token('c')), sep);
    expect(lastFrame()).toBe('b | c');
    expect(lastFrame()).not.toMatch(/^\s*\|/);
  });

  it('leaves no dangling separator when a trailing token is omitted', () => {
    const { lastFrame } = renderBar(tokens(token('a'), token('b'), false), sep);
    expect(lastFrame()).toBe('a | b');
    expect(lastFrame()).not.toMatch(/\|\s*$/);
  });

  it('collapses separators around an omitted middle token', () => {
    const { lastFrame } = renderBar(tokens(token('a'), false, token('c')), sep);
    expect(lastFrame()).toBe('a | c');
  });
});
