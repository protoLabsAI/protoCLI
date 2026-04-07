/**
 * @license
 * Copyright 2025 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import type { Config } from '../config/config.js';
import { RepoMapService } from '../services/repoMapService.js';
import * as path from 'node:path';

export interface RepoMapToolParams {
  /**
   * Absolute paths to files relevant to the current task (seeds for personalized
   * PageRank). Leave empty to get the globally most-connected files.
   */
  seedFiles?: string[];
  /**
   * Maximum number of files to return. Defaults to 20.
   */
  topN?: number;
}

class RepoMapToolInvocation extends BaseToolInvocation<
  RepoMapToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: RepoMapToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const seeds = this.params.seedFiles;
    if (seeds && seeds.length > 0) {
      const names = seeds.map((f) => path.basename(f)).join(', ');
      return `repo map (seeded from ${names})`;
    }
    return 'repo map (top connected files)';
  }

  async execute(): Promise<ToolResult> {
    const projectRoot = this.config.getWorkingDir();
    const service = new RepoMapService(projectRoot);

    const result = await service.getRelevantFiles(
      this.params.seedFiles ?? [],
      Math.min(this.params.topN ?? 20, 50),
    );

    const text = RepoMapService.format(result, projectRoot);

    return {
      llmContent: text,
      returnDisplay: text,
    };
  }
}

/**
 * RepoMapTool — get a PageRank-ranked view of the most relevant files in the
 * codebase relative to a set of seed files.
 *
 * Uses import-graph analysis to surface the files most likely to be relevant
 * for a task, without requiring the agent to read every file in the repo.
 */
export class RepoMapTool extends BaseDeclarativeTool<
  RepoMapToolParams,
  ToolResult
> {
  static readonly Name = ToolNames.REPO_MAP;

  constructor(private readonly config: Config) {
    super(
      RepoMapTool.Name,
      ToolDisplayNames.REPO_MAP,
      'Get a PageRank-ranked map of the most relevant source files in the repository. ' +
        'Analyzes import graphs to surface the files most likely needed for your task. ' +
        'Provide seedFiles (files already known to be relevant) for a personalized result; ' +
        'leave empty for the globally most-connected files. ' +
        'Returns file paths with their exported symbol names.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          seedFiles: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Absolute paths to files already known to be relevant. Used to personalize ' +
              'PageRank — files imported by or that import the seeds rank higher.',
          },
          topN: {
            type: 'number',
            description:
              'Maximum number of files to return (default: 20, max: 50).',
          },
        },
        required: [],
      },
    );
  }

  protected createInvocation(
    params: RepoMapToolParams,
  ): ToolInvocation<RepoMapToolParams, ToolResult> {
    return new RepoMapToolInvocation(this.config, params);
  }
}
