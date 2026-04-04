/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseWebSearchProvider } from '../base-provider.js';
import type { WebSearchResult, DashScopeProviderConfig } from '../types.js';

/**
 * Web search provider using Alibaba Cloud DashScope API.
 * Note: This provider requires OAuth credentials and is not available
 * when using API key authentication.
 */
export class DashScopeProvider extends BaseWebSearchProvider {
  readonly name = 'DashScope';

  constructor(_config: DashScopeProviderConfig) {
    super();
  }

  isAvailable(): boolean {
    // DashScope provider requires OAuth credentials which are no longer supported
    return false;
  }

  protected async performSearch(
    _query: string,
    _signal: AbortSignal,
  ): Promise<WebSearchResult> {
    throw new Error('DashScope provider is not available');
  }
}
