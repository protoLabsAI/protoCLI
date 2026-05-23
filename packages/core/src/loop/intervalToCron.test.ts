/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { intervalToCron, intervalMsToCron } from './intervalToCron.js';

describe('intervalToCron — minutes', () => {
  it('5m → */5 * * * *', () => {
    const r = intervalToCron('5m');
    expect(r.cron).toBe('*/5 * * * *');
    expect(r.rounded).toBe(false);
    expect(r.description).toMatch(/every 5 minute/);
  });

  it('every clean divisor of 60 maps directly', () => {
    expect(intervalToCron('1m').cron).toBe('*/1 * * * *');
    expect(intervalToCron('2m').cron).toBe('*/2 * * * *');
    expect(intervalToCron('15m').cron).toBe('*/15 * * * *');
    expect(intervalToCron('30m').cron).toBe('*/30 * * * *');
  });

  it('7m rounds to the nearest clean step (6 or 10)', () => {
    const r = intervalToCron('7m');
    expect(r.rounded).toBe(true);
    expect(['*/6 * * * *', '*/10 * * * *']).toContain(r.cron);
  });
});

describe('intervalToCron — hours', () => {
  it('2h → 0 */2 * * *', () => {
    const r = intervalToCron('2h');
    expect(r.cron).toBe('0 */2 * * *');
    expect(r.rounded).toBe(false);
  });

  it('90m rounds to ~2h', () => {
    const r = intervalToCron('90m');
    expect(r.rounded).toBe(true);
    expect(r.cron).toBe('0 */2 * * *');
  });

  it('clean divisors of 24 map directly', () => {
    expect(intervalToCron('1h').cron).toBe('0 */1 * * *');
    expect(intervalToCron('3h').cron).toBe('0 */3 * * *');
    expect(intervalToCron('12h').cron).toBe('0 */12 * * *');
  });
});

describe('intervalToCron — days', () => {
  it('1d → 0 0 */1 * *', () => {
    const r = intervalToCron('1d');
    expect(r.cron).toBe('0 0 */1 * *');
    expect(r.rounded).toBe(false);
  });

  it('7d → 0 0 */7 * *', () => {
    expect(intervalToCron('7d').cron).toBe('0 0 */7 * *');
  });
});

describe('intervalMsToCron', () => {
  it('accepts pre-parsed ms values', () => {
    expect(intervalMsToCron(5 * 60_000).cron).toBe('*/5 * * * *');
    expect(intervalMsToCron(60 * 60_000).cron).toBe('0 */1 * * *');
  });

  it('rounds sub-minute values up to 1 minute', () => {
    expect(intervalMsToCron(30_000).cron).toBe('*/1 * * * *');
  });
});
