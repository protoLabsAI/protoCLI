/**
 * @license
 * Copyright 2025 protoLabs.studio
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  methods,
  type AgentContext,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from '@agentclientprotocol/sdk';

/**
 * The outbound (agent → client) surface proto actually uses, factored out of
 * the SDK's connection type.
 *
 * Historically proto threaded the SDK's `AgentSideConnection` straight into
 * `Session`, `SubAgentTracker`, and the ACP filesystem service. The 0.27 SDK
 * deprecates `AgentSideConnection` in favour of an app-style API where outbound
 * calls go through a per-connection `AgentContext`. This interface is the seam:
 * consumers depend on it instead of the concrete connection, and
 * {@link AgentContextChannel} adapts the new `AgentContext` to it.
 *
 * The shape is deliberately a structural subset of the old `AgentSideConnection`
 * so existing call sites and test doubles need only a type swap.
 */
export interface AcpClientChannel {
  sessionUpdate(params: SessionNotification): Promise<void>;
  requestPermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse>;
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  /** Send a custom (non-standard) notification to the client. */
  extNotification(
    method: string,
    params: Record<string, unknown>,
  ): Promise<void>;
  /** Resolves when the underlying ACP connection closes. */
  readonly closed: Promise<void>;
}

/**
 * Adapts the 0.27 app-API `AgentContext` to {@link AcpClientChannel}.
 *
 * The `AgentContext` handed to every handler wraps the connection's single,
 * long-lived `ConnectionContext` — its `notify`/`request` write straight to the
 * live connection (see the SDK's `jsonrpc` `ConnectionContext`, constructed once
 * per `Connection` and passed to every dispatched handler). So a context
 * captured during one handler stays valid for the whole connection lifetime,
 * which is what lets proto emit `session/update` from background work (the cron
 * scheduler, the fire-and-forget post-turn harness) that runs after the
 * originating `session/prompt` handler has already returned. Sends after the
 * peer disconnects reject via the connection, which is the desired behaviour.
 */
export class AgentContextChannel implements AcpClientChannel {
  constructor(
    private readonly ctx: AgentContext,
    readonly closed: Promise<void>,
  ) {}

  sessionUpdate(params: SessionNotification): Promise<void> {
    return this.ctx.notify(methods.client.session.update, params);
  }

  requestPermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    return this.ctx.request(methods.client.session.requestPermission, params);
  }

  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    return this.ctx.request(methods.client.fs.readTextFile, params);
  }

  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    return this.ctx.request(methods.client.fs.writeTextFile, params);
  }

  extNotification(
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    return this.ctx.notify(method, params);
  }
}
