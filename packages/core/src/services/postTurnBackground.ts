/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@google/genai';
import type { Config } from '../config/config.js';
import { extractSessionMemory } from './sessionMemory/index.js';
import { extractMemories } from '../memory/memoryExtractor.js';
import { runEvolvePass } from './evolveService.js';

/**
 * Fire-and-forget the post-turn harness-background passes after a completed turn:
 *
 *   - **session-memory checkpoint** → `.proto/session-notes.md`, the long-horizon
 *     continuity record compaction later reuses as a rebuild seed;
 *   - **memory consolidation** → project-memory proposals;
 *   - **skill evolution** → reusable-pattern detection from the recent turns.
 *
 * Each pass is internally gated (token thresholds, intervals, enable flags), so
 * calling this every turn is cheap and safe. The interactive TUI runs the same
 * trio after each turn (`useGeminiStream`); this is the shared entry point so the
 * top-level **ACP** (`acp-integration/Session`) and **headless**
 * (`nonInteractiveCli`) turn loops get the identical long-horizon harness.
 *
 * Call this from **top-level** turn loops only. Each pass spawns an `AgentHeadless`
 * subagent (which runs on `agent-core`), so wiring it into the subagent runtime
 * itself would recurse — and the session-notes checkpoint is a single per-project
 * file owned by the main session that a subagent must not overwrite.
 *
 * Never throws — each pass is independent and best-effort.
 */
export function firePostTurnBackground(
  config: Config,
  history: Content[],
  tokenCount: number,
): void {
  // Session-memory checkpoint (gated internally on token thresholds).
  void extractSessionMemory(config, history, tokenCount).catch(() => {});

  // Memory consolidation (recent-message window, project scope).
  void extractMemories(config, 10, 'project').catch(() => {});

  // Skill evolution from the recent turns (gated internally on an interval).
  const recentMessages: Array<{ role: string; text: string }> = [];
  for (const entry of history.slice(-20)) {
    const text = (entry.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join(' ')
      .trim();
    if (text) recentMessages.push({ role: entry.role as string, text });
  }
  void runEvolvePass(config, recentMessages).catch(() => {});
}
