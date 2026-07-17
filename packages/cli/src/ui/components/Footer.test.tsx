/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { Footer } from './Footer.js';
import * as useTerminalSize from '../hooks/useTerminalSize.js';
import { type UIState, UIStateContext } from '../contexts/UIStateContext.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { VimModeProvider } from '../contexts/VimModeContext.js';
import type { LoadedSettings } from '../../config/settings.js';
import { ApprovalMode } from '@qwen-code/qwen-code-core';

vi.mock('../hooks/useTerminalSize.js');
vi.mock('./VoiceMicButton.js', () => ({ VoiceMicButton: () => null }));
const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);

const defaultProps = {
  model: 'gemini-pro',
};

const createMockConfig = (overrides = {}) => ({
  getModel: vi.fn(() => defaultProps.model),
  getDebugMode: vi.fn(() => false),
  getContentGeneratorConfig: vi.fn(() => ({ contextWindowSize: 131072 })),
  getMcpServers: vi.fn(() => ({})),
  getBlockedMcpServers: vi.fn(() => []),
  ...overrides,
});

const createMockUIState = (overrides: Partial<UIState> = {}): UIState =>
  ({
    sessionStats: {
      lastPromptTokenCount: 100,
    },
    geminiMdFileCount: 0,
    contextFileNames: [],
    showToolDescriptions: false,
    ideContextState: undefined,
    voiceEnabled: false,
    voiceBackendAvailable: false,
    voiceState: 'idle' as const,
    ...overrides,
  }) as UIState;

const createMockSettings = (): LoadedSettings =>
  ({
    merged: {
      general: {
        vimMode: false,
      },
    },
  }) as LoadedSettings;

const renderWithWidth = (width: number, uiState: UIState) => {
  useTerminalSizeMock.mockReturnValue({ columns: width, rows: 24 });
  return render(
    <ConfigContext.Provider value={createMockConfig() as never}>
      <VimModeProvider settings={createMockSettings()}>
        <UIStateContext.Provider value={uiState}>
          <Footer />
        </UIStateContext.Provider>
      </VimModeProvider>
    </ConfigContext.Provider>,
  );
};

describe('<Footer />', () => {
  it('renders the component', () => {
    const { lastFrame } = renderWithWidth(120, createMockUIState());
    expect(lastFrame()).toBeDefined();
  });

  it('does not display the working directory or branch name', () => {
    const { lastFrame } = renderWithWidth(120, createMockUIState());
    expect(lastFrame()).not.toMatch(/\(.*\*\)/);
  });

  it('displays the context percentage', () => {
    const { lastFrame } = renderWithWidth(120, createMockUIState());
    expect(lastFrame()).toMatch(/\d+(\.\d+)?% context used/);
  });

  it('displays the abbreviated context percentage on narrow terminal', () => {
    const { lastFrame } = renderWithWidth(99, createMockUIState());
    expect(lastFrame()).toMatch(/\d+%/);
  });

  describe('footer rendering (golden snapshots)', () => {
    it('renders complete footer on wide terminal', () => {
      const { lastFrame } = renderWithWidth(120, createMockUIState());
      expect(lastFrame()).toMatchSnapshot('complete-footer-wide');
    });

    it('renders complete footer on narrow terminal', () => {
      const { lastFrame } = renderWithWidth(79, createMockUIState());
      expect(lastFrame()).toMatchSnapshot('complete-footer-narrow');
    });
  });

  // The left slot shows exactly ONE thing, chosen by a priority chain. Each
  // branch is pinned here so a refactor of that chain cannot silently reorder
  // or drop a state.
  describe('left slot priority chain (golden snapshots)', () => {
    const leftStates: Array<[name: string, overrides: Partial<UIState>]> = [
      ['voice-recording', { voiceState: 'recording' as const }],
      ['voice-transcribing', { voiceState: 'transcribing' as const }],
      ['ctrl-c-pressed-once', { ctrlCPressedOnce: true }],
      ['ctrl-d-pressed-once', { ctrlDPressedOnce: true }],
      ['escape-prompt', { showEscapePrompt: true }],
      ['shell-mode', { shellModeActive: true }],
      ['auto-accept-mode', { showAutoAcceptIndicator: ApprovalMode.AUTO_EDIT }],
      ['yolo-mode', { showAutoAcceptIndicator: ApprovalMode.YOLO }],
      ['default-mode', { showAutoAcceptIndicator: ApprovalMode.DEFAULT }],
    ];

    it.each(leftStates)('renders left slot: %s', (name, overrides) => {
      const { lastFrame } = renderWithWidth(120, createMockUIState(overrides));
      expect(lastFrame()).toMatchSnapshot(`left-${name}`);
    });

    // Priority is the contract, not an accident: recording must beat every
    // lower-priority state when several are true at once.
    it('prefers voice recording over ctrl-c and shell mode', () => {
      const { lastFrame } = renderWithWidth(
        120,
        createMockUIState({
          voiceState: 'recording' as const,
          ctrlCPressedOnce: true,
          shellModeActive: true,
        }),
      );
      expect(lastFrame()).toContain('Recording');
      expect(lastFrame()).not.toContain('Ctrl+C');
    });

    it('prefers ctrl-c over the escape prompt', () => {
      const { lastFrame } = renderWithWidth(
        120,
        createMockUIState({ ctrlCPressedOnce: true, showEscapePrompt: true }),
      );
      expect(lastFrame()).toContain('Ctrl+C');
      expect(lastFrame()).not.toContain('Esc again');
    });
  });

  // The right slot is an ordered token array; order and separators are the
  // contract that a registry refactor must preserve.
  describe('right slot token order (golden snapshots)', () => {
    it('renders sandbox + debug + context together', () => {
      useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
      vi.stubEnv('SANDBOX', 'sandbox-exec');
      const { lastFrame } = render(
        <ConfigContext.Provider
          value={createMockConfig({ getDebugMode: vi.fn(() => true) }) as never}
        >
          <VimModeProvider settings={createMockSettings()}>
            <UIStateContext.Provider value={createMockUIState()}>
              <Footer />
            </UIStateContext.Provider>
          </VimModeProvider>
        </ConfigContext.Provider>,
      );
      expect(lastFrame()).toMatchSnapshot('right-sandbox-debug-context');
      vi.unstubAllEnvs();
    });

    it('omits the context token when no prompt tokens are counted', () => {
      const { lastFrame } = renderWithWidth(
        120,
        createMockUIState({
          sessionStats: { lastPromptTokenCount: 0 },
        } as Partial<UIState>),
      );
      expect(lastFrame()).not.toMatch(/% context used/);
    });
  });
});
