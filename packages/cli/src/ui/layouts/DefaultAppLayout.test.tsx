/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { DefaultAppLayout } from './DefaultAppLayout.js';
import { UIStateContext, type UIState } from '../contexts/UIStateContext.js';
import {
  UIActionsContext,
  type UIActions,
} from '../contexts/UIActionsContext.js';
import { AgentViewProvider } from '../contexts/AgentViewContext.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { StreamingState } from '../types.js';

// Drive terminal size deterministically: the real useTerminalSize listens on
// process.stdout and updates via React state, which doesn't flush predictably
// under fake timers. Mocking it lets us change width via an explicit rerender.
let mockSize = { columns: 100, rows: 40 };
vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => mockSize,
}));

// Heavy children are irrelevant to the resize→reflow wiring under test; stub
// them so the layout renders without pulling in their dependency graphs.
vi.mock('../components/MainContent.js', () => ({
  MainContent: () => <Text>MainContent</Text>,
}));
vi.mock('../components/DialogManager.js', () => ({
  DialogManager: () => <Text>DialogManager</Text>,
}));
vi.mock('../components/Composer.js', () => ({
  Composer: () => <Text>Composer</Text>,
}));
vi.mock('../components/ExitWarning.js', () => ({
  ExitWarning: () => null,
}));
vi.mock('../components/messages/BtwMessage.js', () => ({
  BtwMessage: () => null,
}));
vi.mock('../components/agent-view/AgentTabBar.js', () => ({
  AgentTabBar: () => null,
}));
vi.mock('../components/agent-view/AgentChatView.js', () => ({
  AgentChatView: () => null,
}));
vi.mock('../components/agent-view/AgentComposer.js', () => ({
  AgentComposer: () => null,
}));
vi.mock('../components/StatusBar.js', () => ({
  StatusBar: () => null,
}));
vi.mock('../components/BackgroundAgentsPanel.js', () => ({
  BackgroundAgentsPanel: () => null,
}));
vi.mock('../components/TranscriptOverlay.js', () => ({
  TranscriptOverlay: () => null,
}));

describe('DefaultAppLayout resize reflow', () => {
  const refreshStatic = vi.fn();

  const mockUIActions = {
    refreshStatic,
    closeTranscript: vi.fn(),
  } as unknown as UIActions;

  const mockConfig = {
    getTargetDir: () => '/mock/cwd',
  } as unknown as import('@qwen-code/qwen-code-core').Config;

  const mockUIState: Partial<UIState> = {
    streamingState: StreamingState.Idle,
    isTranscriptOpen: false,
    dialogsVisible: false,
    mainControlsRef: { current: null },
    mainAreaWidth: 80,
    terminalWidth: 100,
    btwItem: undefined,
    historyManager: {
      addItem: vi.fn(),
      history: [],
      updateItem: vi.fn(),
      clearItems: vi.fn(),
      loadHistory: vi.fn(),
    },
  };

  // A fresh element per render: React bails out of re-rendering when handed the
  // same element reference, which would stop the mocked width change from ever
  // reaching the component.
  const makeTree = () => (
    <ConfigContext.Provider value={mockConfig}>
      <UIActionsContext.Provider value={mockUIActions}>
        <AgentViewProvider>
          <UIStateContext.Provider value={mockUIState as UIState}>
            <DefaultAppLayout />
          </UIStateContext.Provider>
        </AgentViewProvider>
      </UIActionsContext.Provider>
    </ConfigContext.Provider>
  );

  // Real timers: Ink flushes passive effects through its own reconciler
  // scheduler, which doesn't advance predictably under fake timers. A short
  // wait lets an effect (and its debounce timer) run. FLUSH < 150ms debounce
  // (effect scheduled, timer not yet fired); SETTLE > 150ms (timer fired).
  const FLUSH_MS = 10;
  const SETTLE_MS = 250;
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    refreshStatic.mockClear();
    mockSize = { columns: 100, rows: 40 };
  });

  it('does not refresh static on first mount', async () => {
    render(makeTree());
    await wait(SETTLE_MS);
    expect(refreshStatic).not.toHaveBeenCalled();
  });

  it('refreshes static once after a width change settles', async () => {
    const { rerender } = render(makeTree());
    await wait(FLUSH_MS);
    mockSize = { columns: 60, rows: 40 };
    rerender(makeTree());
    await wait(FLUSH_MS);
    // Debounced: the effect scheduled the timer but it hasn't fired yet.
    expect(refreshStatic).not.toHaveBeenCalled();
    await wait(SETTLE_MS);
    expect(refreshStatic).toHaveBeenCalledTimes(1);
  });

  it('debounces a burst of width changes into a single refresh', async () => {
    const { rerender } = render(makeTree());
    await wait(FLUSH_MS);
    for (const columns of [90, 80, 70]) {
      mockSize = { columns, rows: 40 };
      rerender(makeTree());
      await wait(FLUSH_MS); // < debounce, so each change resets the timer
    }
    await wait(SETTLE_MS);
    expect(refreshStatic).toHaveBeenCalledTimes(1);
  });

  it('does not refresh static when only the height changes', async () => {
    const { rerender } = render(makeTree());
    await wait(FLUSH_MS);
    mockSize = { columns: 100, rows: 20 }; // width unchanged, height differs
    rerender(makeTree());
    await wait(SETTLE_MS);
    expect(refreshStatic).not.toHaveBeenCalled();
  });
});
