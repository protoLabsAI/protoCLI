/**
 * @license
 * Copyright 2025 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { sessionScopeLock } from './scopeLock.js';

/**
 * A sprint contract: the explicit pre-implementation agreement on what will
 * change, why, and how success is measured.
 *
 * Produced by the `sprint-contract` skill. Activating a contract arms the
 * scope lock — any write outside the permitted file set is rejected.
 */
export interface SprintContract {
  task: string;
  filesToCreate: string[];
  filesToModify: string[];
  functionsToChange: Record<string, string[]>;
  acceptanceCriteria: string[];
  implementationSequence: string[];
  risks: string[];
  createdAt: number;
}

const CONTRACT_FILENAME = '.proto/sprint-contract.json';

export class SprintContractService {
  /**
   * Parse a sprint contract from a JSON string (output from the skill).
   * Throws if the JSON is invalid or missing required fields.
   */
  static parse(json: string): SprintContract {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error('Sprint contract JSON is invalid');
    }

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('Sprint contract must be a JSON object');
    }

    const obj = raw as Record<string, unknown>;

    const required = ['filesToCreate', 'filesToModify', 'acceptanceCriteria'];
    for (const field of required) {
      if (!Array.isArray(obj[field])) {
        throw new Error(
          `Sprint contract missing required array field: ${field}`,
        );
      }
    }

    return {
      task: typeof obj['task'] === 'string' ? obj['task'] : '',
      filesToCreate: (obj['filesToCreate'] as string[]) ?? [],
      filesToModify: (obj['filesToModify'] as string[]) ?? [],
      functionsToChange:
        (obj['functionsToChange'] as Record<string, string[]>) ?? {},
      acceptanceCriteria: (obj['acceptanceCriteria'] as string[]) ?? [],
      implementationSequence: (obj['implementationSequence'] as string[]) ?? [],
      risks: (obj['risks'] as string[]) ?? [],
      createdAt: Date.now(),
    };
  }

  /**
   * Activate the session scope lock from a contract.
   * All files in filesToCreate and filesToModify become the permitted set.
   */
  static activateScopeLock(contract: SprintContract): void {
    const permitted = [
      ...contract.filesToCreate,
      ...contract.filesToModify,
    ].map((p) => path.normalize(p));

    sessionScopeLock.activate(permitted);
  }

  /**
   * Persist the contract to `.proto/sprint-contract.json` for audit and
   * reload. Creates the `.proto/` directory if it doesn't exist.
   */
  static async persist(
    contract: SprintContract,
    projectRoot: string,
  ): Promise<void> {
    const dir = path.join(projectRoot, '.proto');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(projectRoot, CONTRACT_FILENAME);
    await fs.writeFile(filePath, JSON.stringify(contract, null, 2), 'utf8');
  }

  /**
   * Load a previously persisted contract from disk, if it exists.
   * Returns null if no contract file is present.
   */
  static async load(projectRoot: string): Promise<SprintContract | null> {
    const filePath = path.join(projectRoot, CONTRACT_FILENAME);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return SprintContractService.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Load a contract from disk and re-activate the scope lock.
   * Call on session resume if a contract was left from a previous session.
   */
  static async resumeFromDisk(projectRoot: string): Promise<boolean> {
    const contract = await SprintContractService.load(projectRoot);
    if (!contract) return false;
    SprintContractService.activateScopeLock(contract);
    return true;
  }

  /**
   * Format a contract as a human-readable summary for injection into context.
   */
  static format(contract: SprintContract): string {
    const files = [
      ...contract.filesToCreate.map((f) => `  + ${f} (create)`),
      ...contract.filesToModify.map((f) => `  ~ ${f} (modify)`),
    ].join('\n');

    const criteria = contract.acceptanceCriteria
      .map((c, i) => `  ${i + 1}. ${c}`)
      .join('\n');

    return (
      `Sprint Contract: ${contract.task}\n\n` +
      `File scope (${contract.filesToCreate.length + contract.filesToModify.length} files):\n${files}\n\n` +
      `Acceptance criteria:\n${criteria}`
    );
  }
}
