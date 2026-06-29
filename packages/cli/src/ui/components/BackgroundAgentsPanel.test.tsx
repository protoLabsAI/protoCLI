/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../hooks/useBackgroundAgentProgress.js', () => ({
  useBackgroundAgentProgress: vi.fn(() => ({
    activeAgents: [],
    lastFinished: null,
  })),
}));

import { useBackgroundAgentProgress } from '../hooks/useBackgroundAgentProgress.js';
import { BackgroundAgentsPanel } from './BackgroundAgentsPanel.js';

const mockAgents = vi.mocked(useBackgroundAgentProgress);

const agent = (over: Record<string, unknown> = {}) => ({
  agentId: 'a1',
  agentName: 'general-purpose',
  round: 2,
  toolName: undefined as string | undefined,
  startedAt: 0,
  ...over,
});

describe('<BackgroundAgentsPanel />', () => {
  beforeEach(() => {
    mockAgents.mockReturnValue({ activeAgents: [], lastFinished: null });
  });

  it('renders nothing when no agents are active', () => {
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    expect(lastFrame()).toBe('');
  });

  it('shows the agent name and current turn', () => {
    mockAgents.mockReturnValue({
      activeAgents: [agent({ agentName: 'test-agent', round: 2 })],
      lastFinished: null,
    });
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    expect(lastFrame()).toContain('⟳ test-agent: turn 2');
  });

  it('shows the running tool name when present', () => {
    mockAgents.mockReturnValue({
      activeAgents: [
        agent({ agentName: 'general-purpose', toolName: 'web_fetch' }),
      ],
      lastFinished: null,
    });
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    expect(lastFrame()).toContain('⟳ general-purpose: web_fetch');
  });

  it('excludes the session-memory note writer (routine housekeeping = noise)', () => {
    mockAgents.mockReturnValue({
      activeAgents: [
        agent({ agentId: 'm', agentName: 'session-memory', toolName: 'write' }),
      ],
      lastFinished: null,
    });
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    // Only session-memory is active → the panel renders nothing.
    expect((lastFrame() ?? '').trim()).toBe('');
    expect(lastFrame() ?? '').not.toContain('notes');
  });

  it('shows real subagents while filtering session-memory out of a mixed list', () => {
    mockAgents.mockReturnValue({
      activeAgents: [
        agent({ agentId: 'm', agentName: 'session-memory', toolName: 'write' }),
        agent({
          agentId: 'g',
          agentName: 'general-purpose',
          toolName: 'web_fetch',
        }),
      ],
      lastFinished: null,
    });
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('⟳ general-purpose: web_fetch');
    expect(frame).not.toContain('notes');
  });

  it('renders a card per active agent', () => {
    mockAgents.mockReturnValue({
      activeAgents: [
        agent({ agentId: 'a1', agentName: 'one', round: 1 }),
        agent({ agentId: 'a2', agentName: 'two', round: 3 }),
      ],
      lastFinished: null,
    });
    const { lastFrame } = render(<BackgroundAgentsPanel />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('⟳ one: turn 1');
    expect(frame).toContain('⟳ two: turn 3');
    // Two distinct lines (one card each).
    expect(frame.split('\n').filter((l) => l.includes('⟳')).length).toBe(2);
  });
});
