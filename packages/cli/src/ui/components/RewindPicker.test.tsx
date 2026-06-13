/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/** @vitest-environment jsdom */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Checkpoint } from '@qwen-code/qwen-code-core';

// Mock the core checkpointStore so we can feed the picker fixed checkpoints.
vi.mock('@qwen-code/qwen-code-core', async () => {
  const actual = await vi.importActual('@qwen-code/qwen-code-core');
  return {
    ...actual,
    checkpointStore: {
      listMainThread: vi.fn(),
    },
  };
});

// Pin the terminal size so every checkpoint row is rendered (the picker hides
// rows when the terminal is short, which would otherwise make this test flaky).
vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({ columns: 100, rows: 40 }),
}));

import { RewindPicker } from './RewindPicker.js';
import { KeypressProvider } from '../contexts/KeypressContext.js';
import { checkpointStore } from '@qwen-code/qwen-code-core';

const listMainThread = vi.mocked(checkpointStore.listMainThread);

function makeCheckpoint(overrides: Partial<Checkpoint>): Checkpoint {
  return {
    promptId: 'session########0',
    userPrompt: 'do a thing',
    timestamp: 1_700_000_000_000,
    fileSnapshots: new Map<string, string>(),
    hasShellExecution: false,
    ...overrides,
  };
}

const noop = () => {};
const props = {
  onRestoreFilesAndConversation: noop,
  onRestoreConversationOnly: noop,
  onRestoreFilesOnly: noop,
  onSummarizeFromHere: noop,
  onCancel: noop,
};

describe('RewindPicker — shell (non-rewindable) indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the ⚠ shell tag on a checkpoint whose turn ran a shell command', () => {
    listMainThread.mockReturnValue([
      makeCheckpoint({
        promptId: 'session########0',
        userPrompt: 'edit a file',
        hasShellExecution: false,
      }),
      makeCheckpoint({
        promptId: 'session########1',
        userPrompt: 'run the migration',
        hasShellExecution: true,
      }),
    ]);

    const { lastFrame } = render(
      <KeypressProvider kittyProtocolEnabled={false}>
        <RewindPicker {...props} />
      </KeypressProvider>,
    );
    expect(lastFrame()).toContain('⚠ shell');
  });

  it('omits the ⚠ shell tag when no checkpoint ran a shell command', () => {
    listMainThread.mockReturnValue([
      makeCheckpoint({ userPrompt: 'edit a file', hasShellExecution: false }),
    ]);

    const { lastFrame } = render(
      <KeypressProvider kittyProtocolEnabled={false}>
        <RewindPicker {...props} />
      </KeypressProvider>,
    );
    expect(lastFrame()).not.toContain('⚠ shell');
  });
});
