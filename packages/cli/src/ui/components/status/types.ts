/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

/**
 * One addressable cell in a status surface (the Footer or the StatusBar).
 *
 * Tokens are data, not JSX: a surface declares an ordered array of them and
 * hands it to <TokenBar />, which owns separator placement. Adding a pill is
 * therefore a push into an array rather than another hand-placed <Sep />.
 */
export interface StatusToken {
  /** Stable identity — used as the React key and to address a token in tests. */
  key: string;
  /** The rendered cell. Must render something; use `null` to omit a token. */
  node: React.ReactNode;
}

/**
 * A token, or a falsy value meaning "not applicable right now".
 *
 * Letting builders return falsy is what keeps separator placement correct:
 * omitted tokens never reach <TokenBar />, so it can never draw a separator
 * against a cell that rendered nothing.
 */
export type MaybeToken = StatusToken | false | null | undefined;

/** Drop inapplicable tokens, preserving declared order. */
export function tokens(...items: MaybeToken[]): StatusToken[] {
  return items.filter((item): item is StatusToken => Boolean(item));
}

/**
 * First applicable token wins.
 *
 * Models a slot that shows exactly one thing chosen by priority — the Footer's
 * left slot, where "recording" outranks "press ctrl+c again" outranks the
 * default hint. Order in the argument list *is* the priority order.
 */
export function firstToken(...items: MaybeToken[]): StatusToken | null {
  return items.find((item): item is StatusToken => Boolean(item)) ?? null;
}
