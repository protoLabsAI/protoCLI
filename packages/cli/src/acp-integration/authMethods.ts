/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
import type { AuthMethod } from '@agentclientprotocol/sdk';

export function buildAuthMethods(): AuthMethod[] {
  return [
    {
      id: AuthType.USE_OPENAI,
      name: 'Use OpenAI API key',
      description: 'Requires setting the `OPENAI_API_KEY` environment variable',
      _meta: {
        type: 'terminal',
        args: [`--auth-type=${AuthType.USE_OPENAI}`],
      },
    },
    {
      id: AuthType.USE_ANTHROPIC,
      name: 'Use Anthropic API key',
      description:
        'Requires setting the `ANTHROPIC_API_KEY` environment variable',
      _meta: {
        type: 'terminal',
        args: [`--auth-type=${AuthType.USE_ANTHROPIC}`],
      },
    },
    {
      id: AuthType.USE_GEMINI,
      name: 'Use Gemini API key',
      description: 'Requires setting the `GEMINI_API_KEY` environment variable',
      _meta: {
        type: 'terminal',
        args: [`--auth-type=${AuthType.USE_GEMINI}`],
      },
    },
    {
      id: AuthType.USE_VERTEX_AI,
      name: 'Use Vertex AI',
      description: 'Requires setting the `GOOGLE_API_KEY` environment variable',
      _meta: {
        type: 'terminal',
        args: [`--auth-type=${AuthType.USE_VERTEX_AI}`],
      },
    },
  ];
}

export function filterAuthMethodsById(
  authMethods: AuthMethod[],
  authMethodId: string,
): AuthMethod[] {
  return authMethods.filter((method) => method.id === authMethodId);
}

export function pickAuthMethodsForDetails(details?: string): AuthMethod[] {
  const authMethods = buildAuthMethods();
  if (!details) {
    return authMethods;
  }
  return authMethods;
}
