/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';
import { StatusBar } from './StatusBar.js';

// Pin the hostname so golden snapshots are machine-independent; homedir() is
// left real because tildify() depends on it.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
  return {
    ...actual,
    default: { ...actual, hostname: () => 'test-host' },
    hostname: () => 'test-host',
  };
});

vi.mock('../hooks/useGitBranchName.js', () => ({
  useGitBranchName: vi.fn(() => undefined),
}));

vi.mock('../hooks/useGitDiffStat.js', () => ({
  useGitDiffStat: vi.fn(() => null),
}));

import { useGitBranchName } from '../hooks/useGitBranchName.js';
import { useGitDiffStat } from '../hooks/useGitDiffStat.js';

const mockBranch = vi.mocked(useGitBranchName);
const mockDiff = vi.mocked(useGitDiffStat);

const render$ = (props: Partial<React.ComponentProps<typeof StatusBar>> = {}) =>
  render(<StatusBar cwd="/home/user/project" terminalWidth={120} {...props} />);

describe('<StatusBar />', () => {
  beforeEach(() => {
    mockBranch.mockReturnValue(undefined);
    mockDiff.mockReturnValue(null);
  });

  it('renders the ⟡ logo mark', () => {
    const { lastFrame } = render$();
    expect(lastFrame()).toContain('⟡');
  });

  it('displays the current hostname', () => {
    const { lastFrame } = render$();
    expect(lastFrame()).toContain(os.hostname());
  });

  it('displays the hostname icon ⬡', () => {
    const { lastFrame } = render$();
    expect(lastFrame()).toContain('⬡');
  });

  it('displays the cwd with home collapsed to ~', () => {
    const home = os.homedir();
    const { lastFrame } = render$({ cwd: `${home}/projects/myapp` });
    expect(lastFrame()).toContain('~/projects/myapp');
  });

  it('displays the ⌂ icon for cwd', () => {
    const { lastFrame } = render$();
    expect(lastFrame()).toContain('⌂');
  });

  it('shows git branch when available', () => {
    mockBranch.mockReturnValue('main');
    const { lastFrame } = render$();
    expect(lastFrame()).toContain('⎇');
    expect(lastFrame()).toContain('main');
  });

  it('hides git branch section when no branch', () => {
    mockBranch.mockReturnValue(undefined);
    const { lastFrame } = render$();
    expect(lastFrame()).not.toContain('⎇');
  });

  it('shows diff stat when there are changed files', () => {
    mockDiff.mockReturnValue({
      filesChanged: 3,
      linesAdded: 10,
      linesRemoved: 2,
    });
    const { lastFrame } = render$();
    expect(lastFrame()).toContain('3 files');
    expect(lastFrame()).toContain('+10');
    expect(lastFrame()).toContain('−2');
  });

  it('hides diff stat when there are no changes', () => {
    mockDiff.mockReturnValue({
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
    });
    const { lastFrame } = render$();
    expect(lastFrame()).not.toContain('files');
  });

  it('shows bg session badge when bgSessionActive is true', () => {
    const { lastFrame } = render$({ bgSessionActive: true });
    expect(lastFrame()).toContain('⟳ bg session');
  });

  // Pins separator placement and badge order, which is what a token-array
  // refactor is most likely to disturb.
  describe('status bar rendering (golden snapshots)', () => {
    it('renders the minimal bar (no branch, no diff)', () => {
      const { lastFrame } = render$();
      expect(lastFrame()).toMatchSnapshot('statusbar-minimal');
    });

    it('renders every token at once', () => {
      mockBranch.mockReturnValue('main');
      mockDiff.mockReturnValue({
        filesChanged: 3,
        linesAdded: 10,
        linesRemoved: 2,
      });
      const { lastFrame } = render$({ bgSessionActive: true });
      expect(lastFrame()).toMatchSnapshot('statusbar-all-tokens');
    });

    it('renders a diff with only additions', () => {
      mockDiff.mockReturnValue({
        filesChanged: 1,
        linesAdded: 7,
        linesRemoved: 0,
      });
      const { lastFrame } = render$();
      expect(lastFrame()).toMatchSnapshot('statusbar-additions-only');
    });
  });
});
