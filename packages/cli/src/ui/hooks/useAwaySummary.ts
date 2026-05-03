/**
 * @license
 * Copyright 2026 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generates and displays a 1-3 sentence "where you left off" recap when the
 * user returns to a terminal that has been blurred for ≥
 * `awayThresholdMinutes`. Best-effort: silently no-ops on disabled,
 * unavailable config, in-flight turn, or any generation failure. The recap
 * is debounced per blur cycle — a single back-and-forth produces at most
 * one recap.
 *
 * Adapted from QwenLM/qwen-code's `useAwaySummary` hook (introduced in
 * #3434, finalized in #3482). Differences from upstream:
 *
 * - Uses our existing `HistoryItemRecap` (`type: 'recap'`) instead of
 *   the upstream-only `HistoryItemAwayRecap` (`type: 'away_recap'`). One
 *   item type, rendered the same way regardless of whether it came from
 *   `/recap` or the auto-fire path.
 * - Dedup gate counts `'recap'` items, matching the unified type.
 *
 * Mirrors Claude Code's gating constants exactly:
 *   - Need at least MIN_USER_MESSAGES_TO_FIRE user turns total before any
 *     auto-recap fires (don't fire on a near-empty session).
 *   - If a recap is already in history, need at least
 *     MIN_USER_MESSAGES_SINCE_LAST_RECAP new user turns since then before
 *     another can fire (prevents back-to-back duplicates when the user
 *     briefly alt-tabs twice with no new work between).
 */

import { useEffect, useRef } from 'react';
import { generateSessionRecap, type Config } from '@qwen-code/qwen-code-core';
import type { HistoryItem, HistoryItemWithoutId } from '../types.js';
import { MessageType } from '../types.js';

const DEFAULT_AWAY_THRESHOLD_MINUTES = 5;

const MIN_USER_MESSAGES_TO_FIRE = 3;
const MIN_USER_MESSAGES_SINCE_LAST_RECAP = 2;

export interface UseAwaySummaryOptions {
  enabled: boolean;
  config: Config | null;
  isFocused: boolean;
  isIdle: boolean;
  addItem: (item: HistoryItemWithoutId, baseTimestamp: number) => number;
  /**
   * The current chat history. Read at fire time only (via a ref) so the
   * effect doesn't re-run on every history change.
   */
  history: HistoryItem[];
  /**
   * Minutes the terminal must be blurred before an auto-recap fires on
   * the next focus-in. Falsy / non-positive values fall back to the
   * 5-minute default (matching Claude Code).
   */
  awayThresholdMinutes?: number;
}

/**
 * Whether enough new user activity has happened since the last recap to
 * justify another one.
 */
function shouldFireRecap(history: HistoryItem[]): boolean {
  let userMessageCount = 0;
  let lastRecapIndex = -1;
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    if (item.type === 'user') userMessageCount++;
    if (item.type === 'recap') lastRecapIndex = i;
  }
  if (userMessageCount < MIN_USER_MESSAGES_TO_FIRE) return false;
  if (lastRecapIndex === -1) return true;
  let userSinceLast = 0;
  for (let i = lastRecapIndex + 1; i < history.length; i++) {
    if (history[i].type === 'user') userSinceLast++;
  }
  return userSinceLast >= MIN_USER_MESSAGES_SINCE_LAST_RECAP;
}

export function useAwaySummary(options: UseAwaySummaryOptions): void {
  const {
    enabled,
    config,
    isFocused,
    isIdle,
    addItem,
    history,
    awayThresholdMinutes,
  } = options;

  const blurredAtRef = useRef<number | null>(null);
  const recapPendingRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);

  // Hold the latest isIdle / history snapshots in refs so they can be
  // consulted at fire time without becoming effect deps (which would
  // re-arm the effect on every streamed token / message).
  const isIdleRef = useRef(isIdle);
  isIdleRef.current = isIdle;
  const historyRef = useRef(history);
  historyRef.current = history;

  const thresholdMs =
    (awayThresholdMinutes && awayThresholdMinutes > 0
      ? awayThresholdMinutes
      : DEFAULT_AWAY_THRESHOLD_MINUTES) *
    60 *
    1000;

  useEffect(() => {
    if (!enabled || !config) {
      inFlightRef.current?.abort();
      inFlightRef.current = null;
      blurredAtRef.current = null;
      return;
    }

    if (!isFocused) {
      if (blurredAtRef.current === null) {
        blurredAtRef.current = Date.now();
      }
      return;
    }

    const blurredAt = blurredAtRef.current;
    if (blurredAt === null) return;

    if (Date.now() - blurredAt < thresholdMs) {
      // Brief blur; reset and wait for the next away cycle.
      blurredAtRef.current = null;
      return;
    }

    if (recapPendingRef.current) return;
    // Wait for idle; do NOT clear blurredAtRef so this effect re-fires
    // (with isIdle in the deps) when the streaming turn finishes.
    if (!isIdleRef.current) return;

    if (!shouldFireRecap(historyRef.current)) {
      blurredAtRef.current = null;
      return;
    }

    blurredAtRef.current = null;
    recapPendingRef.current = true;
    const controller = new AbortController();
    inFlightRef.current = controller;

    void generateSessionRecap(config, controller.signal)
      .then((recap) => {
        if (controller.signal.aborted || !recap) return;
        if (!isIdleRef.current) return;
        const item: HistoryItemWithoutId = {
          type: MessageType.RECAP,
          text: recap.text,
        };
        addItem(item, Date.now());

        // Mirror the recording the slash-command processor does for
        // manual `/recap`, so the auto-fired recap also survives `/resume`.
        // Only record the `result` phase — recording an `invocation`
        // would replay a fake `> /recap` user line on resume.
        try {
          config.getChatRecordingService?.()?.recordSlashCommand({
            phase: 'result',
            rawCommand: '/recap',
            outputHistoryItems: [{ ...item } as Record<string, unknown>],
          });
        } catch {
          // Recap is best-effort — never let a recording failure surface.
        }
      })
      .finally(() => {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
        recapPendingRef.current = false;
      });
  }, [enabled, config, isFocused, isIdle, addItem, thresholdMs]);

  useEffect(
    () => () => {
      inFlightRef.current?.abort();
    },
    [],
  );
}
