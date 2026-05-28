/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OSC 21337 "tab status" — a colored indicator dot plus short status text that
 * supported terminals (e.g. Ghostty, tab-capable Alacritty builds) render in
 * the *tab*, distinct from the window title set via OSC 2. This is the same
 * mechanism Claude Code / Codex use to show running-vs-idle per tab.
 *
 * Terminals that don't recognize OSC 21337 discard the sequence silently, so
 * it's safe to emit unconditionally — we don't gate on terminal detection.
 * Output must be wrapped with `wrapForMultiplexer` so tmux/screen carry it to
 * the outer terminal.
 */

const ESC = '\x1b';
const BEL = '\x07';
const ST = `${ESC}\\`; // String Terminator (ESC \)
const OSC_TAB_STATUS = 21337;

export type TabStatusKind = 'idle' | 'busy' | 'waiting';

interface TabStatusPreset {
  /** Indicator dot color, #RRGGBB. */
  indicator: string;
  /** Short status label shown next to the dot. */
  status: string;
  /** Status text color, #RRGGBB. */
  statusColor: string;
}

// Mapping mirrors the OSC 21337 usage guide's suggested presets.
const PRESETS: Record<TabStatusKind, TabStatusPreset> = {
  idle: { indicator: '#00d75f', status: 'Idle', statusColor: '#888888' },
  busy: { indicator: '#ff9500', status: 'Working…', statusColor: '#ff9500' },
  waiting: { indicator: '#5f87ff', status: 'Waiting', statusColor: '#5f87ff' },
};

/**
 * kitty beeps on BEL-terminated OSC; prefer ST there. BEL is fine (and more
 * widely accepted) everywhere else.
 */
function terminator(): string {
  const term = process.env['TERM'] ?? '';
  const termProgram = process.env['TERM_PROGRAM'] ?? '';
  const isKitty = term.includes('kitty') || termProgram === 'kitty';
  return isKitty ? ST : BEL;
}

function oscTabStatus(payload: string): string {
  return `${ESC}]${OSC_TAB_STATUS};${payload}${terminator()}`;
}

/** Escape `;` and `\` in status text per the OSC 21337 spec. */
function escapeStatus(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll(';', '\\;');
}

/**
 * Wrap an escape sequence for terminal-multiplexer passthrough so it reaches
 * the outer terminal. No-op outside a multiplexer. tmux 3.3+ gates DCS
 * passthrough behind `allow-passthrough` (default off); when off it silently
 * drops the sequence — no worse than not emitting it.
 */
export function wrapForMultiplexer(sequence: string): string {
  if (process.env['TMUX']) {
    const escaped = sequence.replaceAll(ESC, ESC + ESC);
    return `${ESC}Ptmux;${escaped}${ESC}\\`;
  }
  if (process.env['STY']) {
    return `${ESC}P${sequence}${ESC}\\`;
  }
  return sequence;
}

/** OSC 21337 sequence for a tab-status kind, wrapped for multiplexer passthrough. */
export function buildTabStatus(kind: TabStatusKind): string {
  const p = PRESETS[kind];
  return wrapForMultiplexer(
    oscTabStatus(
      `indicator=${p.indicator};status=${escapeStatus(p.status)};status-color=${p.statusColor}`,
    ),
  );
}

/** Clears all three tab-status fields. Emit when opting out so no stale dot lingers. */
export function buildClearTabStatus(): string {
  return wrapForMultiplexer(oscTabStatus('indicator=;status=;status-color='));
}
