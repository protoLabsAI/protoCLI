/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MessageActionReturn,
  SlashCommand,
  SubmitPromptActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import {
  LOOP_STOP_ALIASES,
  DEFAULT_LOOP_INTERVAL_MS,
  intervalMsToCron,
  tryParseInterval,
  type CronJob,
  type CronScheduler,
  humanReadableCron,
} from '@qwen-code/qwen-code-core';

const STOP_TOKENS = new Set<string>(LOOP_STOP_ALIASES);
const LIST_TOKENS = new Set<string>(['list', 'ls']);
const JOB_ID_RE = /^[a-z0-9]{8}$/;

/**
 * `/loop [interval] <prompt>` — schedule a recurring prompt via the cron
 * scheduler. The first iteration fires immediately; subsequent iterations
 * fire on the chosen cadence (default 10m if no interval is given).
 *
 * Other forms:
 * - `/loop`               — list active jobs (or report "none")
 * - `/loop list`          — explicit list
 * - `/loop clear`         — cancel all active jobs (aliases: stop, off, cancel)
 * - `/loop <id>`          — cancel a specific job by its 8-character id
 *
 * Supports the same parsing rules as the bundled `loop` skill so the model's
 * prior behaviour stays consistent for users.
 */
export const loopCommand: SlashCommand = {
  name: 'loop',
  description:
    'schedule a recurring prompt (e.g. "/loop 5m check deploy"; /loop list to inspect; /loop stop to cancel all)',
  kind: CommandKind.BUILT_IN,
  action: async (
    context,
    args,
  ): Promise<MessageActionReturn | SubmitPromptActionReturn | void> => {
    const config = context.services.config;
    if (!config) {
      return err('Loop command requires an initialised config.');
    }
    if (!config.isCronEnabled()) {
      return err(
        'Scheduling is disabled. Enable it with `experimental.cron: true` in settings or `PROTO_ENABLE_CRON=1`.',
      );
    }

    const scheduler = config.getCronScheduler();
    const trimmed = args.trim();

    // /loop — list (or "no jobs" message)
    if (!trimmed) {
      return info(listText(scheduler));
    }

    const lower = trimmed.toLowerCase();

    // /loop list | /loop ls
    if (LIST_TOKENS.has(lower)) {
      return info(listText(scheduler));
    }

    // /loop clear | stop | off | cancel
    if (STOP_TOKENS.has(lower)) {
      const cancelled = cancelAll(scheduler);
      return info(
        cancelled === 0
          ? 'No active loops to stop.'
          : `Cancelled ${cancelled} loop${cancelled === 1 ? '' : 's'}.`,
      );
    }

    // /loop <id> — single-token job-id delete
    if (JOB_ID_RE.test(trimmed)) {
      const ok = scheduler.delete(trimmed);
      return info(
        ok ? `Cancelled loop ${trimmed}.` : `No loop with id ${trimmed}.`,
      );
    }

    // /loop [interval] <prompt>
    const parsed = parseScheduleArgs(trimmed);
    if (parsed.prompt.length === 0) {
      return err(
        'Loop requires a prompt. Usage: `/loop [interval] <prompt>` (interval defaults to 10m).',
      );
    }

    let cron: ReturnType<typeof intervalMsToCron>;
    try {
      cron = parsed.intervalMs
        ? intervalMsToCron(parsed.intervalMs)
        : intervalMsToCron(DEFAULT_LOOP_INTERVAL_MS);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }

    let job;
    try {
      job = scheduler.create(cron.cron, parsed.prompt, /* recurring */ true);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }

    // Echo what we scheduled so the user sees the cadence we picked, then
    // fire the first iteration immediately so the work starts now.
    const roundedNote = cron.rounded ? ` (rounded to ${cron.description})` : '';
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text:
          `Scheduled ${job.id} ${cron.description}${roundedNote}: ${parsed.prompt}\n` +
          `  Use /loop list to inspect, /loop ${job.id} to cancel this one, or /loop stop to cancel all.`,
      },
      Date.now(),
    );

    return { type: 'submit_prompt', content: parsed.prompt };
  },
};

interface ParsedScheduleArgs {
  intervalMs: number | null;
  prompt: string;
}

/**
 * Parse `[interval] <prompt>` or `<prompt> every <interval>`. Returns
 * `intervalMs: null` to mean "no interval supplied; caller should default".
 */
export function parseScheduleArgs(args: string): ParsedScheduleArgs {
  const tokens = args.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === '') {
    return { intervalMs: null, prompt: '' };
  }

  // Rule 1: leading single-token interval ("5m", "30s")
  const leadOne = tryParseInterval(tokens[0]);
  if (leadOne !== null) {
    return { intervalMs: leadOne, prompt: tokens.slice(1).join(' ') };
  }

  // Rule 1b: leading two-token interval ("5 minutes")
  if (tokens.length >= 2) {
    const leadTwo = tryParseInterval(`${tokens[0]} ${tokens[1]}`);
    if (leadTwo !== null) {
      return { intervalMs: leadTwo, prompt: tokens.slice(2).join(' ') };
    }
  }

  // Rule 2: trailing "every <N><unit>" or "every <N> <unit-word>"
  const trailingMatch = args.match(
    /\s+every\s+(\d+(?:\.\d+)?\s*[a-zA-Z]+)\s*$/i,
  );
  if (trailingMatch) {
    const everyMs = tryParseInterval(trailingMatch[1]);
    if (everyMs !== null) {
      const promptOnly = args.slice(0, trailingMatch.index ?? 0).trim();
      return { intervalMs: everyMs, prompt: promptOnly };
    }
  }

  // Rule 3: no interval — caller substitutes default
  return { intervalMs: null, prompt: args.trim() };
}

export function listText(scheduler: CronScheduler): string {
  const jobs = scheduler.list();
  if (jobs.length === 0) {
    return 'No active loops. Start one with `/loop [interval] <prompt>`.';
  }
  const lines = [`${jobs.length} active loop${jobs.length === 1 ? '' : 's'}:`];
  for (const job of jobs) {
    lines.push(
      `  [${job.id}] ${humanReadableCron(job.cronExpr)}: ${truncate(job.prompt, 80)}`,
    );
  }
  lines.push('Use `/loop <id>` to cancel one, or `/loop stop` to cancel all.');
  return lines.join('\n');
}

function cancelAll(scheduler: CronScheduler): number {
  const jobs = scheduler.list();
  let n = 0;
  for (const job of jobs) {
    if (scheduler.delete(job.id)) n++;
  }
  return n;
}

function info(content: string): MessageActionReturn {
  return { type: 'message', messageType: 'info', content };
}

function err(content: string): MessageActionReturn {
  return { type: 'message', messageType: 'error', content };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// Re-export the CronJob type alias so test files don't need to dig for it.
export type { CronJob };
