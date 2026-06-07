/**
 * @license
 * Copyright 2025 protoLabs
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Anthropic SDK compatibility layer.
 *
 * Drop-in compatible API surface for code that was written against
 * `@anthropic-ai/claude-agent-sdk`. Import paths and identifiers stay
 * identical; only the package name changes:
 *
 *   - import { query, Options, HookCallback } from '@anthropic-ai/claude-agent-sdk';
 *   + import { query, Options, HookCallback } from '@protolabsai/sdk/anthropic-compat';
 *
 * Internally we translate the Claude-shaped options/hooks into the proto
 * SDK's native shapes before handing them to the underlying transport. The
 * goal is a mechanical migration for existing consumers — most callers
 * shouldn't need a single field rename.
 *
 * What's translated:
 *   - `maxTurns`          -> `maxSessionTurns`
 *   - `allowedTools`      -> `coreTools`
 *   - `disallowedTools`   -> `excludeTools`
 *   - `pathToClaudeCodeExecutable` -> `pathToQwenExecutable` (the underlying CLI
 *     binary; field name kept inside proto for backwards compat until a future
 *     rename in proto-sdk itself.)
 *   - `permissionMode: 'bypassPermissions'` -> `permissionMode: 'yolo'`
 *   - `hooks: { PreToolUse: [{ hooks: [fn] }] }` (matcher-array shape) ->
 *     `hookCallbacks: { PreToolUse: [wrappedFn] }` (flat record). Each hook
 *     callback is wrapped so the inner Claude-shaped fn keeps receiving its
 *     usual `{ hook_event_name, tool_name, tool_input, tool_use_id }` input
 *     and its `{ decision: 'block', reason }` return value is translated into
 *     proto's `{ shouldSkip, message }` HookCallbackResult.
 *
 * What's silently dropped (Claude-specific options proto doesn't surface):
 *   - `settingSources`, `resume`, `agents`, `maxThinkingTokens`,
 *     `allowDangerouslySkipPermissions`, `outputFormat`. Callers using these
 *     should migrate to the proto-native API at `@protolabsai/sdk`.
 *
 * Re-exported as-is (identical shape between the two SDKs):
 *   - `tool`, `createSdkMcpServer`, `AbortError`, `isAbortError`
 *   - SDK message type guards and types
 */

import { query as protoQuery } from './query/createQuery.js';
// Reach into proto's options type through `Parameters<typeof protoQuery>` so
// the import doesn't trigger dts-bundle-generator to pull in proto's
// `types/types.ts` (which would inline conflicting `HookCallback` and
// `HookCallbackResult` definitions into the bundled .d.ts).
type ProtoQueryOptions = NonNullable<
  Parameters<typeof protoQuery>[0]['options']
>;
type ProtoCanUseTool = NonNullable<ProtoQueryOptions['canUseTool']>;
import type { Query } from './query/Query.js';

// Proto SDK's hook callback shapes are inlined here rather than imported as
// `HookCallback` / `HookCallbackResult` to avoid a name collision in the
// generated .d.ts bundle: this module exports its own Claude-shaped
// `HookCallback` and `HookCallbackResult` of the same names, and
// dts-bundle-generator inlines BOTH definitions in the output, causing
// duplicate-export errors. Keeping the proto-side types unnamed (just inline
// function types) sidesteps the collision without complicating the API.
type ProtoHookCallback = (
  input: unknown,
  toolUseId: string | null,
) => Promise<ProtoHookCallbackResult> | ProtoHookCallbackResult;

interface ProtoHookCallbackResult {
  shouldSkip?: boolean;
  shouldInterrupt?: boolean;
  suppressOutput?: boolean;
  message?: string;
}

// ============================================================================
// Re-exports — identical surface, no translation needed
// ============================================================================

export { AbortError, isAbortError } from './types/errors.js';
export { tool } from './mcp/tool.js';
export { createSdkMcpServer } from './mcp/createSdkMcpServer.js';
// Type guards and message types live in protocol.ts in proto SDK; everything
// else (CanUseTool, McpServerConfig, etc.) lives in types.ts. Re-export from
// both so consumers get the full Claude-compatible surface from one module.
export {
  isSDKUserMessage,
  isSDKAssistantMessage,
  isSDKSystemMessage,
  isSDKResultMessage,
  isSDKPartialAssistantMessage,
} from './types/protocol.js';
export type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
  SDKMcpServerConfig,
} from './types/protocol.js';
export type { Query } from './query/Query.js';

/**
 * Hook event name. Mirrors proto's `HookEvent` literal union but inlined here
 * (and intentionally NOT re-exported) so dts-bundle-generator doesn't pull in
 * proto's `types/types.ts` — that module declares its own `HookCallback` and
 * `HookCallbackResult` under the same names this compat module exports,
 * which would produce duplicate-export errors in the bundled .d.ts.
 *
 * @internal — not exported. Compat consumers don't address hook events by
 * type anyway; the field is keyed in `hooks` and the input has its own
 * discriminated union via `hook_event_name`.
 */
type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'Notification'
  | 'SubagentStop';

/**
 * Permission callback invoked before a tool runs. Aliased to proto's exact
 * `CanUseTool` type via indirect lookup so the shape stays in sync with proto
 * without importing the type directly (which would trigger
 * dts-bundle-generator to pull conflicting hook types into the bundle).
 */
export type CanUseTool = ProtoCanUseTool;

/**
 * Result a `canUseTool` callback may return. Derived from proto's signature.
 */
export type PermissionResult = Awaited<ReturnType<ProtoCanUseTool>>;

/**
 * MCP stdio server — spawns a local process speaking MCP over stdio.
 */
export interface McpStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * MCP server reachable over HTTP / SSE.
 */
export interface McpHttpServerConfig {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

/**
 * In-process SDK MCP server (created via `createSdkMcpServer`).
 */
export interface McpSdkServerConfig {
  type: 'sdk';
  name: string;
  instance?: unknown;
}

/**
 * MCP server config. A union of the structured Claude/Anthropic shapes plus a
 * generic `Record<string, unknown>` fallback, so callers passing the typed
 * `McpServerConfig` union from `@protolabsai/types` (whose members have no
 * index signature) typecheck without per-callsite casts. The runtime passes
 * `mcpServers` through to proto verbatim regardless of which member is used.
 */
export type McpServerConfig =
  | McpStdioServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfig
  | Record<string, unknown>;

/**
 * System prompt config. Accepts a plain string or Claude's structured preset
 * form. Only the appended text is consumed by proto at runtime (proto has no
 * notion of the `claude_code` preset); a bare preset with no `append` is a
 * no-op.
 */
export interface SystemPromptPreset {
  type: 'preset';
  preset: string;
  append?: string;
}
export type SystemPromptConfig = string | SystemPromptPreset;

/**
 * Structured output format. Accepted at the type level for source
 * compatibility; dropped at runtime (proto has no structured-output option).
 */
export interface OutputFormatJsonSchema {
  type: 'json_schema';
  schema: Record<string, unknown>;
}
export type OutputFormatConfig = string | OutputFormatJsonSchema;

// ============================================================================
// Claude-shaped option types
// ============================================================================

/**
 * Hook input passed to PreToolUse hook callbacks (Claude SDK shape).
 *
 * The protoCLI emits the same `tool_name` / `tool_input` / `tool_use_id`
 * fields the Claude Code CLI did, so the structured payload arrives in the
 * callback already in this shape. `hook_event_name` is synthesized by the
 * compat wrapper since proto's transport doesn't echo it back.
 */
export interface PreToolUseHookInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string | null;
}

/**
 * Hook input passed to PostToolUse hook callbacks.
 */
export interface PostToolUseHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string | null;
  tool_response?: unknown;
}

/**
 * Hook input passed to Stop hook callbacks (terminal stop).
 */
export interface StopHookInput {
  hook_event_name: 'Stop';
  tool_use_id: string | null;
}

/**
 * Hook input passed to SubagentStop hook callbacks.
 */
export interface SubagentStopHookInput {
  hook_event_name: 'SubagentStop';
  tool_use_id: string | null;
}

/**
 * Hook input passed to Notification hook callbacks.
 */
export interface NotificationHookInput {
  hook_event_name: 'Notification';
  tool_use_id: string | null;
  message?: string;
}

/**
 * Union of all possible inputs a Claude-shaped HookCallback may receive.
 */
export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | StopHookInput
  | SubagentStopHookInput
  | NotificationHookInput;

/**
 * Result a Claude-shaped HookCallback may return.
 *
 *   - `{ decision: 'block', reason: '...' }` — block the tool call, surface
 *     `reason` to the model so it can pick a different path.
 *   - `{ continue: false }` — interrupt the session.
 *   - `{}` or `undefined` — allow the operation to proceed.
 */
export interface HookCallbackResult {
  decision?: 'block';
  reason?: string;
  continue?: boolean;
  suppressOutput?: boolean;
}

/**
 * Claude-shaped hook callback. Mirrors `@anthropic-ai/claude-agent-sdk`'s
 * three-argument shape `(input, toolUseId, { signal })`. The compat layer
 * always invokes callbacks with all three arguments: `toolUseId` is `undefined`
 * for session-level events (Stop, Notification) and `signal` is the query's
 * abort signal — a fresh non-aborting signal when no `abortController` was
 * supplied in Options. A one- or two-argument callback remains assignable
 * (extra params are optional to provide). Returns `HookCallbackResult`
 * (synchronously or via a Promise) controlling whether the tool call proceeds.
 */
export type HookCallback = (
  input: HookInput,
  toolUseId: string | undefined,
  options: { signal: AbortSignal },
) => HookCallbackResult | void | Promise<HookCallbackResult | void>;

/**
 * Matcher object used in Claude's `hooks` option. The compat layer flattens
 * `{ hooks: [fn1, fn2] }` matcher entries into proto's flat record of
 * callbacks per event.
 */
export interface HookCallbackMatcher {
  hooks?: HookCallback[];
}

/**
 * Claude-shaped permission mode. The compat layer maps `bypassPermissions` to
 * proto's `yolo`. Other modes pass through if their names already match.
 */
export type PermissionMode =
  | 'default'
  | 'plan'
  | 'auto-edit'
  | 'yolo'
  | 'bypassPermissions';

/**
 * Claude-shaped Options. Field names mirror `@anthropic-ai/claude-agent-sdk`'s
 * Options so consumers can swap the import path with no other changes.
 *
 * Options proto doesn't surface (settingSources, resume, agents, etc.) are
 * accepted at the type level for source compatibility and silently dropped at
 * runtime — see the file header for the full list.
 */
export interface Options {
  model?: string;
  cwd?: string;
  systemPrompt?: SystemPromptConfig;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  allowDangerouslySkipPermissions?: boolean;
  canUseTool?: CanUseTool;
  mcpServers?: Record<string, McpServerConfig>;
  abortController?: AbortController;
  env?: Record<string, string>;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  pathToClaudeCodeExecutable?: string;
  // Claude-specific options accepted for type compatibility and ignored at
  // runtime. Listed explicitly so a typecheck error highlights migration
  // points rather than silently losing data via a catch-all.
  settingSources?: Array<'user' | 'project' | 'local'>;
  resume?: string;
  agents?: Record<string, unknown>;
  maxThinkingTokens?: number;
  outputFormat?: OutputFormatConfig;
}

// ============================================================================
// Translation helpers
// ============================================================================

/**
 * Wrap a Claude-shaped HookCallback for proto's `(input, toolUseId)` signature.
 *
 * Adds `hook_event_name` to the input (proto's transport carries the event
 * name out-of-band; we restore it for callbacks that switch on it), forwards
 * the Claude three-argument shape `(input, toolUseId, { signal })` to the
 * inner callback, and translates Claude-style `{ decision: 'block', reason }`
 * returns into proto's `{ shouldSkip, message }` shape.
 *
 * `signal` is the query's abort signal when an `abortController` was supplied
 * in Options, otherwise a fresh non-aborting signal so the three-arg contract
 * always holds.
 */
function wrapClaudeHookCallback(
  claudeCb: HookCallback,
  event: HookEvent,
  signal: AbortSignal,
): ProtoHookCallback {
  return async (input, toolUseId) => {
    const enrichedInput = {
      hook_event_name: event,
      tool_use_id: toolUseId,
      ...(input as Record<string, unknown>),
    } as HookInput;

    let result: HookCallbackResult | void;
    try {
      result = await Promise.resolve(
        claudeCb(enrichedInput, toolUseId ?? undefined, { signal }),
      );
    } catch (err) {
      // Surface hook errors the same way proto does: don't crash the session,
      // log via the message field so the model sees what happened.
      const message = err instanceof Error ? err.message : String(err);
      return { message: `Hook callback error: ${message}` };
    }

    if (!result) return {};

    const protoResult: ProtoHookCallbackResult = {};
    if (result.decision === 'block') {
      protoResult.shouldSkip = true;
      if (result.reason) protoResult.message = result.reason;
    }
    if (result.continue === false) {
      protoResult.shouldInterrupt = true;
    }
    if (result.suppressOutput) {
      protoResult.suppressOutput = true;
    }
    return protoResult;
  };
}

/**
 * Translate Claude's `hooks: { PreToolUse: [{ hooks: [...] }] }` matcher-array
 * shape into proto's `hookCallbacks: { PreToolUse: [...] }` flat record. Each
 * inner callback is wrapped via `wrapClaudeHookCallback`.
 */
function translateHooks(
  claudeHooks: NonNullable<Options['hooks']>,
  signal: AbortSignal,
): Partial<Record<HookEvent, ProtoHookCallback[]>> {
  const out: Partial<Record<HookEvent, ProtoHookCallback[]>> = {};
  for (const [event, matchers] of Object.entries(claudeHooks) as Array<
    [HookEvent, HookCallbackMatcher[] | undefined]
  >) {
    if (!matchers) continue;
    const flat: ProtoHookCallback[] = [];
    for (const matcher of matchers) {
      for (const cb of matcher.hooks ?? []) {
        flat.push(wrapClaudeHookCallback(cb, event, signal));
      }
    }
    if (flat.length > 0) {
      out[event] = flat;
    }
  }
  return out;
}

/**
 * Translate Claude-shaped Options into proto's ProtoQueryOptions. Field renames,
 * permission-mode aliasing, hook-shape conversion, and silent drops of
 * Claude-only fields all happen here.
 */
function translateOptions(claude: Options): ProtoQueryOptions {
  const {
    maxTurns,
    allowedTools,
    disallowedTools,
    hooks,
    permissionMode,
    pathToClaudeCodeExecutable,
    systemPrompt,
    mcpServers,
    abortController,
    // Claude-specific drops
    settingSources: _settingSources,
    resume: _resume,
    agents: _agents,
    maxThinkingTokens: _maxThinkingTokens,
    allowDangerouslySkipPermissions: _allowDangerously,
    outputFormat: _outputFormat,
    // Passthroughs that share a name in both SDKs
    ...passthrough
  } = claude;

  const proto: ProtoQueryOptions = {
    ...passthrough,
  };

  if (abortController) proto.abortController = abortController;

  if (maxTurns !== undefined) proto.maxSessionTurns = maxTurns;
  if (allowedTools) proto.coreTools = allowedTools;
  if (disallowedTools) proto.excludeTools = disallowedTools;
  if (pathToClaudeCodeExecutable)
    proto.pathToQwenExecutable = pathToClaudeCodeExecutable;

  // systemPrompt: a string passes through verbatim; a structured preset is
  // mapped onto proto's preset shape (proto only consumes `.append` — its
  // preset literal differs from Claude's `claude_code`).
  if (typeof systemPrompt === 'string') {
    proto.systemPrompt = systemPrompt;
  } else if (systemPrompt?.type === 'preset') {
    proto.systemPrompt = {
      type: 'preset',
      preset: 'qwen_code',
      append: systemPrompt.append,
    };
  }

  // mcpServers passes through verbatim; the compat union is wider than proto's
  // type, so cast at this single boundary rather than at every consumer site.
  if (mcpServers) {
    proto.mcpServers = mcpServers as ProtoQueryOptions['mcpServers'];
  }

  if (permissionMode === 'bypassPermissions') {
    proto.permissionMode = 'yolo';
  } else if (permissionMode) {
    proto.permissionMode = permissionMode;
  }

  if (hooks) {
    // Hooks receive the query's abort signal; fall back to a non-aborting
    // signal so the three-argument callback contract always holds.
    const hookSignal = abortController?.signal ?? new AbortController().signal;
    const translated = translateHooks(hooks, hookSignal);
    if (Object.keys(translated).length > 0) {
      proto.hookCallbacks = translated as ProtoQueryOptions['hookCallbacks'];
    }
  }

  return proto;
}

// ============================================================================
// query() — drop-in for @anthropic-ai/claude-agent-sdk's query
// ============================================================================

/**
 * Drop-in replacement for `@anthropic-ai/claude-agent-sdk`'s `query()`.
 *
 * Accepts the same `{ prompt, options }` argument shape, translates the
 * options into proto's native ProtoQueryOptions, and delegates to the underlying
 * proto query transport. The returned `Query` is the same async-iterable
 * `Query` proto returns natively — message shapes are identical between the
 * two SDKs.
 *
 * @example Mechanical migration from @anthropic-ai/claude-agent-sdk
 * ```diff
 * - import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
 * + import { query, type Options } from '@protolabsai/sdk/anthropic-compat';
 *
 *   const stream = query({
 *     prompt: 'Hello',
 *     options: { model: 'claude-sonnet-4-5', maxTurns: 5 } satisfies Options,
 *   });
 *   for await (const msg of stream) {
 *     // ...
 *   }
 * ```
 */
export function query({
  prompt,
  options,
}: {
  prompt: Parameters<typeof protoQuery>[0]['prompt'];
  options?: Options;
}): Query {
  const protoOptions = options ? translateOptions(options) : undefined;
  return protoQuery({ prompt, options: protoOptions });
}
