/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { AuthType } from '@qwen-code/qwen-code-core';
import { buildAuthMethods, filterAuthMethodsById } from './authMethods.js';

describe('buildAuthMethods', () => {
  it('advertises all four supported providers', () => {
    const ids = buildAuthMethods().map((m) => m.id);
    expect(ids).toEqual([
      AuthType.USE_OPENAI,
      AuthType.USE_ANTHROPIC,
      AuthType.USE_GEMINI,
      AuthType.USE_VERTEX_AI,
    ]);
  });

  it('maps each method to the matching --auth-type arg', () => {
    for (const method of buildAuthMethods()) {
      const meta = method._meta as { type: string; args: string[] };
      expect(meta.args).toEqual([`--auth-type=${method.id}`]);
    }
  });

  it('gives every method a name and description', () => {
    for (const method of buildAuthMethods()) {
      expect(method.name).toBeTruthy();
      expect(method.description).toBeTruthy();
    }
  });

  it('uses ids that are valid core AuthType values', () => {
    const validTypes = new Set<string>(Object.values(AuthType));
    for (const method of buildAuthMethods()) {
      expect(validTypes.has(method.id)).toBe(true);
    }
  });
});

describe('filterAuthMethodsById', () => {
  it('returns only the matching method', () => {
    const filtered = filterAuthMethodsById(
      buildAuthMethods(),
      AuthType.USE_ANTHROPIC,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(AuthType.USE_ANTHROPIC);
  });

  it('returns an empty list when no method matches', () => {
    expect(
      filterAuthMethodsById(buildAuthMethods(), 'nonexistent'),
    ).toHaveLength(0);
  });
});
