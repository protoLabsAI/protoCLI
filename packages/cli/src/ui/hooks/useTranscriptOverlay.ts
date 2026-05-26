/**
 * @license
 * Copyright 2026 protoCLI contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { useKeypress, type Key } from './useKeypress.js';
import { keyMatchers, Command } from '../keyMatchers.js';

export interface TranscriptOverlayControl {
  isTranscriptOpen: boolean;
  openTranscript: () => void;
  closeTranscript: () => void;
}

/**
 * Owns the full-screen transcript overlay's open/closed state and the global
 * Ctrl+O binding that toggles it. Self-contained: it registers its own
 * always-on keypress subscriber (Ctrl+O isn't bound to anything else), so the
 * only wiring a host needs is to read `isTranscriptOpen` and render the
 * overlay.
 *
 * The toggle lives here (not in the overlay component) because the overlay is
 * only mounted while open — something always-mounted has to handle the open
 * keypress.
 */
export function useTranscriptOverlay(): TranscriptOverlayControl {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const openTranscript = useCallback(() => setIsTranscriptOpen(true), []);
  const closeTranscript = useCallback(() => setIsTranscriptOpen(false), []);

  // Stable subscriber (mirrors useKeyboardHandling): reassign a ref each render
  // so the closure stays current without re-subscribing.
  const handlerRef = useRef<(key: Key) => void>(() => {});
  handlerRef.current = (key: Key) => {
    if (keyMatchers[Command.TOGGLE_TRANSCRIPT](key)) {
      setIsTranscriptOpen((prev) => !prev);
    }
  };
  const handleKeypress = useCallback((key: Key) => handlerRef.current(key), []);
  useKeypress(handleKeypress, { isActive: true });

  return { isTranscriptOpen, openTranscript, closeTranscript };
}
