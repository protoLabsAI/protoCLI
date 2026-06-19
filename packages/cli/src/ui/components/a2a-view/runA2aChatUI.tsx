/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rich Ink chat UI for talking to a remote A2A agent (`proto agent <name>` in a
 * TTY). Models the in-process `agent-view/` pattern: reuse `HistoryItemDisplay`
 * for rendering (markdown, thoughts) + a `<Static>`/live split, with its own
 * minimal input and a stream loop driven by the A2A client — never touching
 * `useGeminiStream`. Pure relay: the remote agent runs its own tools, so there's
 * no local tool loop here; tool activity is surfaced as dim info lines.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { render, Box, Text, Static, useStdin, useStdout } from 'ink';
import ansiEscapes from 'ansi-escapes';
import Spinner from 'ink-spinner';
import { randomUUID } from 'node:crypto';
import { KeypressProvider } from '../../contexts/KeypressContext.js';
import { SettingsContext } from '../../contexts/SettingsContext.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { loadSettings } from '../../../config/settings.js';
import { themeManager } from '../../themes/theme-manager.js';
import { HistoryItemDisplay } from '../HistoryItemDisplay.js';
import { BaseTextInput } from '../BaseTextInput.js';
import { useTextBuffer } from '../shared/text-buffer.js';
import { theme } from '../../semantic-colors.js';
import type { HistoryItem } from '../../types.js';
import type { A2aClient } from '../../../a2a-client/client.js';

function usage(ev: {
  state: string;
  usage?: Record<string, number>;
  confidence?: number;
}): string {
  const u = ev.usage ?? {};
  const conf = ev.confidence != null ? `, conf ${ev.confidence}` : '';
  return `[${ev.state}] ${u['input_tokens'] ?? 0}→${u['output_tokens'] ?? 0} tok${conf}`;
}

function A2aChat({
  client,
  agentName,
  onExit,
}: {
  client: A2aClient;
  agentName: string;
  onExit: () => void;
}) {
  const { columns: terminalWidth } = useTerminalSize();
  const { stdin, setRawMode } = useStdin();
  const { stdout } = useStdout();

  // Bumping this remounts <Static> so the committed history re-emits at the
  // current width. Ink's <Static> is append-only and never reflows on resize.
  const [staticKey, setStaticKey] = useState(0);
  const [committed, setCommitted] = useState<HistoryItem[]>([]);
  const [pendingText, setPendingText] = useState('');
  const [pendingThought, setPendingThought] = useState('');
  const [running, setRunning] = useState(false);
  // When set, the agent paused for input (HITL) on this task; the next message
  // answers it (resumes that task) rather than starting a fresh turn.
  const [awaitingTaskId, setAwaitingTaskId] = useState<string | null>(null);

  const contextId = useRef(randomUUID()); // pin one memory thread for the session
  const idRef = useRef(0);
  const nextId = () => idRef.current++;
  const abortRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef('');
  const didMount = useRef(false);

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { height: 1, width: Math.max(20, terminalWidth - 4) },
    stdin,
    setRawMode,
    isValidPath: () => false,
  });

  // Reflow committed history on terminal resize. Ink's <Static> writes each item
  // to stdout once and never re-wraps it, so on resize the history keeps its old
  // wrapping while the live region reflows — visually broken. Mirror the main
  // TUI's refreshStatic: synchronized-output clear + remount <Static> at the new
  // width. Trailing-debounced (~120ms) so a resize *drag* redraws once, not per
  // SIGWINCH (which flickers/duplicates). Caveat: only the visible frame can be
  // reflowed — content already scrolled into the terminal's scrollback is
  // immutable cell data and stays as-wrapped (inherent terminal limitation).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return; // skip the initial mount — nothing to reflow yet
    }
    const t = setTimeout(() => {
      stdout.write('\x1b[?2026h'); // begin synchronized update (atomic frame swap)
      stdout.write(ansiEscapes.clearTerminal);
      stdout.write('\x1b[?2026l'); // end synchronized update
      setStaticKey((k) => k + 1);
    }, 120);
    return () => clearTimeout(t);
  }, [terminalWidth, stdout]);

  const stopInflight = useCallback(() => {
    abortRef.current?.abort();
    if (taskIdRef.current) void client.cancel(taskIdRef.current);
  }, [client]);

  // Ctrl+C exits; Esc cancels an in-flight turn. exitOnCtrlC is off at render().
  useKeypress(
    (key) => {
      if (key.ctrl && key.name === 'c') {
        stopInflight();
        onExit();
      } else if (key.name === 'escape' && running) {
        stopInflight();
      }
    },
    { isActive: true },
  );

  const submit = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (t === '/exit' || t === '/quit') {
        onExit();
        return;
      }
      if (running) return;

      // If the agent paused for input, this message resumes that parked task.
      const resumeTaskId = awaitingTaskId;
      setAwaitingTaskId(null);
      setCommitted((h) => [...h, { type: 'user', text: t, id: nextId() }]);
      setRunning(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Seed cancel with the resume id so an early abort (before any `task`
      // frame) can still cancel the parked task.
      taskIdRef.current = resumeTaskId ?? '';
      let assistant = '';
      let thought = '';
      // Render each tool once per turn. protoAgent emits a tool-call-v1 part on
      // BOTH the started and the (sometimes repeated) status frame for the same
      // toolCallId, so keying off `started` alone double-rendered the ⚙ line.
      const seenTools = new Set<string>();

      try {
        for await (const ev of client.streamMessage(t, {
          contextId: contextId.current,
          taskId: resumeTaskId ?? undefined,
          signal: ctrl.signal,
        })) {
          switch (ev.kind) {
            case 'task':
              taskIdRef.current = ev.taskId;
              break;
            case 'text':
              assistant += ev.delta;
              setPendingText(assistant);
              break;
            case 'thought':
              thought += ev.delta;
              setPendingThought(thought);
              break;
            case 'tool':
              if (!seenTools.has(ev.toolCallId)) {
                seenTools.add(ev.toolCallId);
                setCommitted((h) => [
                  ...h,
                  { type: 'info', text: `⚙ ${ev.name}`, id: nextId() },
                ]);
              }
              break;
            case 'inputRequired':
              setCommitted((h) => [
                ...h,
                { type: 'info', text: `❓ ${ev.prompt}`, id: nextId() },
              ]);
              setAwaitingTaskId(ev.taskId); // next message resumes this task
              break;
            case 'error':
              setCommitted((h) => [
                ...h,
                { type: 'error', text: ev.message, id: nextId() },
              ]);
              break;
            case 'final':
              setCommitted((h) => [
                ...h,
                ...(thought
                  ? [
                      {
                        type: 'gemini_thought',
                        text: thought,
                        id: nextId(),
                      } as HistoryItem,
                    ]
                  : []),
                ...(assistant
                  ? [
                      {
                        type: 'gemini',
                        text: assistant,
                        id: nextId(),
                      } as HistoryItem,
                    ]
                  : []),
                ...(ev.usage
                  ? [
                      {
                        type: 'info',
                        text: usage(ev),
                        id: nextId(),
                      } as HistoryItem,
                    ]
                  : []),
              ]);
              setPendingText('');
              setPendingThought('');
              break;
            default:
              break;
          }
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setCommitted((h) => [
            ...h,
            { type: 'error', text: (e as Error).message, id: nextId() },
          ]);
          // A failed send must not drop a parked input-required task — restore
          // the handle (unless a new pause already set one) so it can be retried.
          setAwaitingTaskId((cur) => cur ?? resumeTaskId);
        }
        setPendingText('');
        setPendingThought('');
      } finally {
        abortRef.current = null;
        taskIdRef.current = '';
        setRunning(false);
      }
    },
    [client, running, onExit, awaitingTaskId],
  );

  return (
    <Box flexDirection="column">
      <Static key={staticKey} items={committed}>
        {(item) => (
          <HistoryItemDisplay
            key={item.id}
            item={item}
            isPending={false}
            terminalWidth={terminalWidth}
          />
        )}
      </Static>

      {pendingThought && (
        <HistoryItemDisplay
          item={{ type: 'gemini_thought', text: pendingThought, id: -2 }}
          isPending
          terminalWidth={terminalWidth}
        />
      )}
      {pendingText && (
        <HistoryItemDisplay
          item={{ type: 'gemini', text: pendingText, id: -1 }}
          isPending
          terminalWidth={terminalWidth}
        />
      )}
      {running && (
        <Box marginX={2}>
          <Text color={theme.text.accent}>
            <Spinner type="dots" />
          </Text>
          <Text color={theme.text.secondary}> {agentName} is thinking…</Text>
        </Box>
      )}

      <BaseTextInput
        buffer={buffer}
        onSubmit={submit}
        isActive={!running}
        placeholder={
          awaitingTaskId
            ? 'Answer the prompt above…'
            : `Message ${agentName}…  (/exit to quit)`
        }
      />
    </Box>
  );
}

/** Render the A2A chat TUI and resolve when the user exits. */
export function runA2aChatUI(
  client: A2aClient,
  agentName: string,
): Promise<void> {
  const settings = loadSettings(process.cwd());
  const themeName = settings.merged.ui?.theme;
  if (themeName) themeManager.setActiveTheme(themeName);

  if (process.stdin.isTTY && !process.stdin.isRaw) {
    process.stdin.setRawMode(true);
  }

  // Resolve explicitly on exit rather than relying on Ink's waitUntilExit, which
  // (under our standalone provider stack + raw-mode stdin) doesn't reliably fire
  // on unmount — leaving the command hung. onExit unmounts AND resolves.
  return new Promise<void>((resolve) => {
    let unmount = () => {};
    const onExit = () => {
      unmount();
      resolve();
    };
    const instance = render(
      <KeypressProvider kittyProtocolEnabled={false}>
        <SettingsContext.Provider value={settings}>
          <A2aChat client={client} agentName={agentName} onExit={onExit} />
        </SettingsContext.Provider>
      </KeypressProvider>,
      { exitOnCtrlC: false },
    );
    unmount = instance.unmount;
  });
}
