/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  parseInterval,
  tryParseInterval,
  formatInterval,
} from './intervalParser.js';

describe('parseInterval', () => {
  it('parses compact tokens with each unit', () => {
    expect(parseInterval('60s')).toBe(60_000);
    expect(parseInterval('5m')).toBe(5 * 60 * 1000);
    expect(parseInterval('2h')).toBe(2 * 60 * 60 * 1000);
    expect(parseInterval('1d')).toBe(24 * 60 * 60 * 1000);
  });

  it('parses natural-language unit names', () => {
    expect(parseInterval('5 minutes')).toBe(5 * 60 * 1000);
    expect(parseInterval('2 hours')).toBe(2 * 60 * 60 * 1000);
    expect(parseInterval('1 day')).toBe(24 * 60 * 60 * 1000);
  });

  it('tolerates surrounding whitespace and casing', () => {
    expect(parseInterval('  5M ')).toBe(5 * 60 * 1000);
    expect(parseInterval('1H')).toBe(60 * 60 * 1000);
  });

  it('rejects intervals below 60 seconds', () => {
    expect(() => parseInterval('30s')).toThrow(/at least 60/);
    expect(() => parseInterval('0m')).toThrow(/at least 60/);
  });

  it('rejects garbage input', () => {
    expect(() => parseInterval('soon')).toThrow(/parse/);
    expect(() => parseInterval('5')).toThrow(/parse/);
    expect(() => parseInterval('')).toThrow();
  });
});

describe('tryParseInterval', () => {
  it('returns ms on success', () => {
    expect(tryParseInterval('5m')).toBe(5 * 60 * 1000);
  });

  it('returns null on failure', () => {
    expect(tryParseInterval('check deploy')).toBeNull();
    expect(tryParseInterval('30s')).toBeNull(); // below minimum
  });
});

describe('formatInterval', () => {
  it('picks the largest clean unit', () => {
    expect(formatInterval(60_000)).toBe('1m');
    expect(formatInterval(5 * 60 * 1000)).toBe('5m');
    expect(formatInterval(60 * 60 * 1000)).toBe('1h');
    expect(formatInterval(24 * 60 * 60 * 1000)).toBe('1d');
  });

  it('falls back to seconds for non-clean values', () => {
    expect(formatInterval(90_000)).toBe('90s');
  });
});
