# Talk to A2A Agents from the Terminal

proto is a **first-class terminal client for [A2A](https://a2a-protocol.org/) agents.** Register an agent once, then `proto agent <name>` to open a streaming chat with it — no URL to retype, no browser. This is the _client_ direction: proto reaches out and talks _to_ a remote agent.

It's the mirror image of [driving proto as an ACP coding agent](/guides/acp-coding-agent), and together they make proto and the protoLabs **protoAgent** fleet talk **both ways**:

| Direction          | Protocol | proto's role | How                                                                           |
| ------------------ | -------- | ------------ | ----------------------------------------------------------------------------- |
| protoAgent → proto | ACP      | agent/server | `proto --acp`; protoAgent's `delegates` plugin spawns proto as a coding agent |
| proto → protoAgent | **A2A**  | **client**   | **`proto agent <name>`; proto streams a turn to the agent over A2A**          |

## protoAgent linkage

[protoAgent](https://github.com/protoLabsAI/protoAgent) is an A2A-native LangGraph agent runtime (and a fork-me template for a fleet of protoLabs agents). Every protoAgent serves an **A2A 1.0** endpoint at `POST /a2a` plus a public **agent card** at `/.well-known/agent-card.json`. proto speaks exactly that surface, so any running protoAgent — or its forks (e.g. `roxy`) — is reachable from your terminal as soon as it's up.

Discovery is built in and mirrors protoAgent's own fleet broadcast/scan: proto probes localhost for agent cards, so a protoAgent running on `:7870` shows up in `proto agents` with no registration at all.

## A2A compatibility

proto implements the **A2A 1.0** client surface that `a2a-sdk` (≥ 1.1) serves:

- **Transport** — JSON-RPC 2.0 over `POST /a2a`, with the mandatory `A2A-Version: 1.0` header.
- **Methods** — `SendStreamingMessage` (SSE), `SendMessage`, `GetTask`, `CancelTask`.
- **Streaming** — Server-Sent Events whose frames are the A2A oneof (`task` / `statusUpdate` / `artifactUpdate` / `message`), rendered live.
- **Conversation** — a per-session `contextId` pins one memory thread, so the agent remembers across turns.
- **Discovery** — the agent card (skills, capabilities, declared extensions, auth schemes).
- **Extensions** — renders the protoLabs A2A extensions: `cost-v1` (token usage), `confidence-v1`, and `tool-call-v1` (live tool activity).
- **Auth** — `Authorization: Bearer …` (from a configured env var) or `X-API-Key`; open endpoints (common locally) need no credentials.

Because it targets the protocol, not the implementation, proto works against **any conformant A2A 1.0 agent**, not just protoAgent.

## Use it

```bash
# See every agent — registered and auto-discovered on your machine — with status
proto agents

# Register a named shortcut (so you never type the URL again)
proto agent add roxy https://roxy.internal:7870

# Open a streaming chat, addressed by name
proto agent roxy
```

`proto agent <name>` resolves the name from your registry first, then falls back to live discovery — so you can connect to a just-discovered agent by name even before you register it.

### Registering with auth

```bash
# Send a Bearer token held in an env var on every request
proto agent add roxy https://roxy.internal:7870 --bearer-env ROXY_TOKEN

# Or a static header / an X-API-Key env var
proto agent add roxy https://roxy.internal:7870 -H "Authorization: Bearer …"
proto agent add roxy https://roxy.internal:7870 --api-key-env ROXY_API_KEY
```

Registered agents live in the `a2aAgents` section of `~/.proto/settings.json` (user scope) or `.proto/settings.json` (project scope, via `--scope project`).

## Commands

| Command                        | What it does                                             |
| ------------------------------ | -------------------------------------------------------- |
| `proto agents`                 | List registered + discovered agents with up/down status  |
| `proto agent <name>`           | Connect and chat (resolves via registry, then discovery) |
| `proto agent add <name> <url>` | Register an agent under a name                           |
| `proto agent remove <name>`    | Unregister an agent                                      |
| `proto agent list [--no-scan]` | Same as `proto agents` (`--no-scan` skips discovery)     |

## See also

- [Drive proto as an ACP Coding Agent](/guides/acp-coding-agent) — the other direction: proto as the agent an orchestrator drives
- [Run Headless](/guides/run-headless) — `proto -p` and stream-json
- [Configure Models & Auth](/guides/configure-models) — endpoints and credentials
