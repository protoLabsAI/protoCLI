/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { windowHistory } from './windowHistory.js';

describe('windowHistory', () => {
  it('returns an empty list unchanged', () => {
    const items: number[] = [];
    const { windowed, olderCount } = windowHistory(items, 10);
    expect(windowed).toBe(items);
    expect(olderCount).toBe(0);
  });

  it('returns the same reference when under the cap (no trimming)', () => {
    const items = [1, 2, 3];
    const result = windowHistory(items, 10);
    expect(result.windowed).toBe(items);
    expect(result.olderCount).toBe(0);
  });

  it('returns the same reference at exactly the cap', () => {
    const items = [1, 2, 3];
    const result = windowHistory(items, 3);
    expect(result.windowed).toBe(items);
    expect(result.olderCount).toBe(0);
  });

  it('keeps the most recent items when over the cap', () => {
    const items = [1, 2, 3, 4, 5];
    const { windowed, olderCount } = windowHistory(items, 2);
    expect(windowed).toEqual([4, 5]);
    expect(olderCount).toBe(3);
  });

  it('does not trim when maxItems is non-positive', () => {
    const items = [1, 2, 3];
    const result = windowHistory(items, 0);
    expect(result.windowed).toBe(items);
    expect(result.olderCount).toBe(0);
  });
});
