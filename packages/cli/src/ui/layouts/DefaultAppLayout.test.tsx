/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Fixed size for layout; the resize handler under test reads process.stdout
// directly, so we drive it via stdout events rather than this hook.
vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({ columns: 100, rows: 40 }),
}));

// Heavy children are irrelevant to the resize→repaint wiring under test; stub
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

describe('DefaultAppLayout resize repaint', () => {
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

  // Each render attaches a resize listener to process.stdout; track instances
  // so afterEach can unmount them and listeners don't leak across tests.
  const instances: Array<ReturnType<typeof render>> = [];
  const mount = () => {
    const instance = render(makeTree());
    instances.push(instance);
    return instance;
  };

  // The resize listener attaches in a passive effect; a short real wait lets it
  // run. SETTLE > RESIZE_THROTTLE_MS (80ms) so the trailing timer has fired.
  const MOUNT_MS = 20;
  const SETTLE_MS = 160;
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const originalColumns = process.stdout.columns;
  const originalRows = process.stdout.rows;

  const resize = (columns: number, rows = process.stdout.rows) => {
    process.stdout.columns = columns;
    process.stdout.rows = rows;
    process.stdout.emit('resize');
  };

  beforeEach(() => {
    refreshStatic.mockClear();
    process.stdout.columns = 100;
    process.stdout.rows = 40;
  });

  afterEach(() => {
    while (instances.length) {
      instances.pop()?.unmount();
    }
    process.stdout.columns = originalColumns;
    process.stdout.rows = originalRows;
  });

  it('does not repaint on first mount', async () => {
    mount();
    await wait(SETTLE_MS);
    expect(refreshStatic).not.toHaveBeenCalled();
  });

  it('repaints immediately on a resize (leading edge)', async () => {
    mount();
    await wait(MOUNT_MS);
    resize(60);
    // Leading edge fires synchronously in the resize handler — no wait needed.
    expect(refreshStatic).toHaveBeenCalledTimes(1);
  });

  it('throttles a burst of resizes into a leading + trailing repaint', async () => {
    mount();
    await wait(MOUNT_MS);
    resize(90);
    resize(85);
    resize(80);
    // Only the leading edge has fired so far; the rest coalesce.
    expect(refreshStatic).toHaveBeenCalledTimes(1);
    await wait(SETTLE_MS);
    // ...plus a single trailing repaint at the throttle boundary.
    expect(refreshStatic).toHaveBeenCalledTimes(2);
  });

  it('ignores a resize event that does not change dimensions', async () => {
    mount();
    await wait(MOUNT_MS);
    process.stdout.emit('resize'); // same 100x40 as mount
    await wait(SETTLE_MS);
    expect(refreshStatic).not.toHaveBeenCalled();
  });

  it('repaints on a height-only change', async () => {
    mount();
    await wait(MOUNT_MS);
    resize(100, 20); // width unchanged, height differs
    expect(refreshStatic).toHaveBeenCalledTimes(1);
  });

  it('removes the resize listener on unmount', async () => {
    const { unmount } = mount();
    await wait(MOUNT_MS);
    unmount();
    resize(50);
    await wait(SETTLE_MS);
    expect(refreshStatic).not.toHaveBeenCalled();
  });
});
