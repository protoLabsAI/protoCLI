# Drive proto as an ACP Coding Agent

proto is a **first-class coding agent over the [Agent Client Protocol](https://agentclientprotocol.com) (ACP)**. Launch it with `proto --acp` and it becomes an ACP _server_ (the agent); an ACP _client_ drives it over JSON-RPC 2.0 on stdin/stdout — an editor like [Zed](/guides/ide-zed), or an **orchestrator** (protoLabs' protoAgent / the projectBoard plugin, or any ACP client) that hands proto a coding task and gets the result back.

Unlike a generic "tool loop", proto carries its own file access, shell, repo map, edit/verify loop, and — crucially — its **full agent harness**, all confined to the session's working directory.

## The whole harness runs over ACP — not a stripped-down mode

This is what makes proto first-class for orchestration: `proto --acp` runs the _same_ [agent harness](/guides/manage-memory) as the interactive TUI, including the long-horizon machinery a long feature build depends on:

- **Session-memory checkpoint** — a background writer maintains `.proto/session-notes.md` (a structured record: current state, task spec, workflow, files & functions, errors, learnings) so context survives across a long, multi-turn session.
- **Compaction** — observation-masking, microcompact, and session-memory-seeded compaction keep the window under budget without losing the thread.
- **Memory consolidation & skill evolution** — project memory and reusable-pattern detection run between turns.
- **Verification & scope gates** — the behavior-verify gate, scope lock, and doom-loop reminders apply the same way.

The headless modes (`proto -p` and the stream-json protocol the SDK uses) run this same harness — see [Run Headless](/guides/run-headless). So whether proto is driven by a human in the TUI, an editor over ACP, or an orchestrator over ACP/headless, it keeps its long-horizon context the same way.

## Launch it

```bash
proto --acp
```

proto authenticates from `~/.proto/settings.json` (or the environment), advertises its auth methods, and waits for a client. The client drives the standard ACP flow:

```
initialize          →  negotiate protocol version + capabilities
session/new (cwd)   →  open a session scoped to a working directory
session/prompt      →  send a task; stream back agent_message / agent_thought / tool_call updates
```

proto supports the stable session lifecycle so an orchestrator can run durable, restart-surviving threads:

- **`session/load`** / **`session/resume`** — reattach a persisted session (continue with full context after a restart).
- **`session/cancel`** — abandon an in-flight turn cleanly.
- **`session/close`** — release a session.
- **`session/request_permission`** — the client answers per its own policy; proto never reaches outside the session `cwd`.

## Orchestrate it

An orchestrator declares proto as an ACP coding agent and dispatches tasks to it. In the protoLabs stack:

- **protoAgent** drives proto through its `delegates` plugin — a `delegate_to(target, query)` over an `acp` delegate (`command: proto`, `args: ["--acp"]`, scoped to a `workdir`).
- **projectBoard** (the board-driven coding plugin) makes proto its **first-class coder**: it pulls a `ready` feature, opens a disposable git worktree, dispatches `proto --acp` into it, and turns the result into a PR.

Any ACP client works, but proto-driving-proto is the supported, purpose-built path — proto is both the best-integrated agent _and_ a clean ACP client of other agents.

## See also

- [Run Headless](/guides/run-headless) — `proto -p` and stream-json, same harness, no ACP client needed
- [Zed](/guides/ide-zed) — use proto as your editor's coding agent over ACP
- [Manage Memory](/guides/manage-memory) — the long-horizon memory the harness maintains
