/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loopCommand, parseScheduleArgs, listText } from './loopCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { CronScheduler } from '@qwen-code/qwen-code-core';

function makeContext(
  scheduler: CronScheduler,
  cronEnabled: boolean = true,
): CommandContext {
  return createMockCommandContext({
    services: {
      config: {
        isCronEnabled: () => cronEnabled,
        getCronScheduler: () => scheduler,
      },
    },
    ui: { addItem: vi.fn() },
  } as unknown as CommandContext);
}

describe('parseScheduleArgs', () => {
  it('parses leading compact interval', () => {
    expect(parseScheduleArgs('5m check deploy')).toEqual({
      intervalMs: 5 * 60 * 1000,
      prompt: 'check deploy',
    });
  });

  it('parses leading two-token interval', () => {
    expect(parseScheduleArgs('5 minutes check deploy')).toEqual({
      intervalMs: 5 * 60 * 1000,
      prompt: 'check deploy',
    });
  });

  it('parses trailing "every <N><unit>"', () => {
    expect(parseScheduleArgs('check deploy every 30m')).toEqual({
      intervalMs: 30 * 60 * 1000,
      prompt: 'check deploy',
    });
  });

  it('parses trailing "every <N> <unit-word>"', () => {
    expect(parseScheduleArgs('run tests every 5 minutes')).toEqual({
      intervalMs: 5 * 60 * 1000,
      prompt: 'run tests',
    });
  });

  it('does not interpret prepositions as intervals', () => {
    // "check every PR" — "every" is not followed by a time expression.
    expect(parseScheduleArgs('check every PR')).toEqual({
      intervalMs: null,
      prompt: 'check every PR',
    });
  });

  it('returns intervalMs: null when no interval is present', () => {
    expect(parseScheduleArgs('just keep an eye on things')).toEqual({
      intervalMs: null,
      prompt: 'just keep an eye on things',
    });
  });

  it('returns empty prompt for empty args', () => {
    expect(parseScheduleArgs('')).toEqual({ intervalMs: null, prompt: '' });
  });

  it('handles leading interval with no prompt', () => {
    expect(parseScheduleArgs('30m')).toEqual({
      intervalMs: 30 * 60 * 1000,
      prompt: '',
    });
  });
});

describe('loopCommand', () => {
  let scheduler: CronScheduler;
  let ctx: CommandContext;

  beforeEach(() => {
    scheduler = new CronScheduler();
    ctx = makeContext(scheduler);
  });

  it('errors when config is not available', async () => {
    const noConfigCtx = createMockCommandContext({
      services: { config: null },
    } as unknown as CommandContext);
    const result = await loopCommand.action!(noConfigCtx, '5m do thing');
    expect(result).toMatchObject({ type: 'message', messageType: 'error' });
  });

  it('errors when cron is not enabled', async () => {
    const disabledCtx = makeContext(scheduler, false);
    const result = await loopCommand.action!(disabledCtx, '5m do thing');
    expect(result).toMatchObject({ type: 'message', messageType: 'error' });
    expect((result as { content: string }).content).toMatch(/cron/i);
  });

  describe('list mode', () => {
    it('reports "no active loops" when scheduler is empty', async () => {
      const result = await loopCommand.action!(ctx, '');
      expect((result as { content: string }).content).toMatch(
        /no active loops/i,
      );
    });

    it('reports "no active loops" via /loop list', async () => {
      const result = await loopCommand.action!(ctx, 'list');
      expect((result as { content: string }).content).toMatch(
        /no active loops/i,
      );
    });

    it('lists scheduled jobs', async () => {
      scheduler.create('*/5 * * * *', 'check deploy', true);
      const result = await loopCommand.action!(ctx, 'list');
      const content = (result as { content: string }).content;
      expect(content).toMatch(/active loop/i);
      expect(content).toMatch(/check deploy/);
    });
  });

  describe('stop / clear', () => {
    it.each(['stop', 'off', 'clear', 'cancel'])(
      'cancels all jobs via "/loop %s"',
      async (alias) => {
        scheduler.create('*/5 * * * *', 'a', true);
        scheduler.create('*/10 * * * *', 'b', true);
        const result = await loopCommand.action!(ctx, alias);
        expect(scheduler.list()).toHaveLength(0);
        expect((result as { content: string }).content).toMatch(/cancelled 2/i);
      },
    );

    it('reports "no active loops" when nothing was scheduled', async () => {
      const result = await loopCommand.action!(ctx, 'stop');
      expect((result as { content: string }).content).toMatch(
        /no active loops/i,
      );
    });
  });

  describe('cancel single job by id', () => {
    it('cancels the matching job', async () => {
      const job = scheduler.create('*/5 * * * *', 'foo', true);
      const result = await loopCommand.action!(ctx, job.id);
      expect(scheduler.list()).toHaveLength(0);
      expect((result as { content: string }).content).toMatch(
        new RegExp(job.id),
      );
    });

    it('reports "no loop with id" when the id is unknown', async () => {
      const result = await loopCommand.action!(ctx, 'abc12345');
      expect((result as { content: string }).content).toMatch(
        /no loop with id abc12345/i,
      );
    });
  });

  describe('schedule mode', () => {
    it('schedules a recurring job and submits the first iteration', async () => {
      const result = await loopCommand.action!(ctx, '5m check deploy');
      expect(result).toEqual({
        type: 'submit_prompt',
        content: 'check deploy',
      });
      const jobs = scheduler.list();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].cronExpr).toBe('*/5 * * * *');
      expect(jobs[0].prompt).toBe('check deploy');
      expect(jobs[0].recurring).toBe(true);
    });

    it('defaults to 10m when no interval is supplied', async () => {
      await loopCommand.action!(ctx, 'just keep watching');
      expect(scheduler.list()[0].cronExpr).toBe('*/10 * * * *');
      expect(scheduler.list()[0].prompt).toBe('just keep watching');
    });

    it('supports trailing "every" clause', async () => {
      await loopCommand.action!(ctx, 'check the build every 2 hours');
      const job = scheduler.list()[0];
      expect(job.cronExpr).toBe('0 */2 * * *');
      expect(job.prompt).toBe('check the build');
    });

    it('errors on interval-only input', async () => {
      const result = await loopCommand.action!(ctx, '30m');
      expect(result).toMatchObject({
        type: 'message',
        messageType: 'error',
      });
      expect((result as { content: string }).content).toMatch(/prompt/i);
      expect(scheduler.list()).toHaveLength(0);
    });

    it('echoes the cadence via ui.addItem', async () => {
      const addItem = ctx.ui.addItem as ReturnType<typeof vi.fn>;
      await loopCommand.action!(ctx, '5m check deploy');
      expect(addItem).toHaveBeenCalledTimes(1);
      const [item] = addItem.mock.calls[0];
      expect(item.text).toMatch(/scheduled/i);
      expect(item.text).toMatch(/every 5 minute/);
    });
  });
});

describe('listText', () => {
  it('renders no-loops message', () => {
    expect(listText(new CronScheduler())).toMatch(/no active loops/i);
  });

  it('renders an active job line', () => {
    const s = new CronScheduler();
    s.create('*/5 * * * *', 'check deploy', true);
    const text = listText(s);
    expect(text).toMatch(/check deploy/);
    expect(text).toMatch(/active loop/i);
  });
});
