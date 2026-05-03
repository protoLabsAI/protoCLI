# Background Agents — Design & Roadmap

A maintainer-oriented map of the **background-agent** subsystem in protoCLI:
what is already wired, what is intentionally deferred, and how we plan to
close the gap with upstream `qwen-code`.

The goal of this document is not to specify a feature — much of the
infrastructure already exists. It is to give us a single pass at the
**shape** of the work so we can sequence the next set of ports without
re-reading the upstream diff every time.

> **2026-05-03 update.** The roadmap below was written before we
> committed to integrating proto into protoLabs Studio (workstacean) as
> the primary delivery vehicle. Sections 4–6 have been reframed: Phase B
> (TUI surface) is mostly out, Phase C (cross-session resume) is dropped,
> and a new active track (SDK surface work driven by workstacean#516)
> takes priority over Phase A. See [§4 Reframed roadmap](#4-reframed-roadmap)
> for the current plan.

---

## 1. What "background agent" means here

Two related but distinct things travel under the same name in our fork:

1. **Background shell tasks** — `run_shell_command` invoked with
   `is_background: true`. The process is detached, output is streamed to a
   file under `<projectTempDir>/<sessionId>/tasks/<taskId>.output`, and a
   `task_id` is returned to the model. These are the kind of tasks the user
   sees with `/bg list` today.

2. **Background subagents** — full `AgentCore` instances running in a
   separate execution context, communicating with the parent through the
   progress event bus. A subagent may itself spawn background shells; the
   two systems compose.

Both share the same lifecycle vocabulary (`running` → `completed` /
`failed` / `killed`) and surface through the same UI hooks. The split
matters for porting because upstream's recent work mostly extends path 2
(headless / SDK / resume) while leaving path 1 stable.

---

## 2. Current state in the fork

### Core (ported and live)

| File                                                                                   | LOC            | Role                                                                                                           |
| -------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/backgroundShells/registry.ts`                                       | 126            | `BackgroundShellRegistry`: tracks long-running shells, pub/sub listeners, `drainPendingNotifications()`        |
| `packages/core/src/backgroundShells/{types,diskOutput,notifications,watcher,index}.ts` | ~340           | Types, disk-tail capture, completion notifications, process-lifecycle watcher                                  |
| `packages/core/src/utils/backgroundProgressEmitter.ts`                                 | 190            | Singleton typed event bus: `agent_started`, `agent_round`, `agent_tool_call`, `agent_finished`, `agent_failed` |
| `packages/core/src/agents/background-store.ts`                                         | 75             | `~/.proto/agents/background.json` persistence with 24h prune                                                   |
| `packages/core/src/tools/bg-stop.ts`                                                   | 168            | `BgStopTool`: SIGTERM → SIGKILL on shell task PIDs                                                             |
| `packages/core/src/tools/task-stop.ts`                                                 | (file present) | `TaskStopTool`: agent-level stop (separate from shell stop)                                                    |
| `packages/core/src/tools/shell.ts`                                                     | —              | `is_background: true` parameter; spawns detached, captures to disk                                             |
| `packages/core/src/agents/runtime/agent-headless.ts`                                   | (file present) | Headless `AgentCore` execution path                                                                            |

### CLI / UI (ported and live)

| File                                                      | Role                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/cli/src/ui/hooks/useBackgroundAgentProgress.ts` | Subscribes to `backgroundProgressEmitter`, exposes `activeAgents[]` and `lastFinished` |
| `packages/cli/src/ui/commands/bgCommand.ts`               | `/bg list` — running + recent shell tasks with status, duration, output path, PID      |
| `packages/cli/src/ui/AppContainer.tsx`                    | Surfaces `lastFinished?.hitLimit` warnings into the conversation history               |
| `packages/cli/src/ui/components/StatusBar.tsx`            | Renders `activeAgents` count                                                           |

### What this gives us today

- The model can fire-and-forget shells and look at output files later.
- The model can stop a runaway shell via `bg_stop`.
- The user sees a count in the status bar and a one-time warning when an
  agent hits its turn/time budget.
- Sessions resume cleanly because shell registry state is in-memory
  per-session and the persistent `background-store.json` is best-effort.

### What this does **not** give us yet

- No model-facing way to send a message into a running subagent.
- No UI for "what is each background agent doing right now" beyond a count.
- No throttled streaming of subagent output back to the parent.
- No cross-session resume of a background agent that was alive when the
  session ended.
- `/tasks` (the upstream-managed pool view) is absent; `/bg list` is our
  thinner stand-in.

---

## 3. Upstream gap (April–May 2026)

The upstream PRs we have not yet ported, ordered by approximate dependency:

| Upstream PR | Title                                                                          | What it adds                                                                    | Dependency                                             |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **#3076**   | background subagents with headless and SDK support                             | Headless agent runner + SDK task events                                         | (foundation; partially landed via `agent-headless.ts`) |
| **#3379**   | headless support and SDK task events for background agents                     | Event surface for SDK consumers                                                 | builds on #3076                                        |
| **#3471**   | model-facing agent control (`task_stop`, `send_message`, per-agent transcript) | New tools the model can call to manage running agents                           | builds on #3076                                        |
| **#3488**   | background-agent UI — pill, combined dialog, detail view                       | TUI surface: pill in status, combined dialog, per-agent detail                  | builds on #3471                                        |
| **#3642**   | managed background shell pool with `/tasks` command                            | Pool view + `/tasks` slash command                                              | independent                                            |
| **#3684**   | event monitor tool with throttled stdout streaming (Phase C)                   | `event_monitor` tool — stream subagent stdout back to parent at controlled rate | builds on #3471                                        |
| **#3687**   | wire background shells into the `task_stop` tool                               | Unifies `bg_stop` + `task_stop` so the model has one stop verb                  | needs both stops merged conceptually                   |
| **#3739**   | background agent resume and continuation                                       | Cross-session resume of interrupted agents                                      | builds on #3471, #3684                                 |

**Skip list** (already-decided exclusions):

- All `vscode-ide-companion` schema fragments — package deleted.
- `auto-memory` integration points — un-ported subsystem; PRs that touch
  `MemoryDialog` or `isAutoMemPath` need that stripped out.
- Anything that imports `BackgroundTaskRegistry` (an upstream symbol that
  was never in the diff we picked up). Where upstream uses it, we use our
  `BackgroundShellRegistry`.

---

## 4. Reframed roadmap

The original three-phase plan assumed proto was the primary product
delivered to a user in a terminal. With workstacean now the orchestrator
of record, that assumption no longer holds. Each phase below is reframed
through the new lens.

### Track 1 (active): SDK surface for workstacean

Tracked at protoCLI#223; driven by workstacean#516. As workstacean lands
proto as a fleet agent, concrete asks land here as small PRs. Likely
surface area:

- Progress event shape — workstacean's `ProtoSdkExecutor.onProgress`
  callback wants distinct events for tool-call lifecycle (started,
  output, completed) so the dashboard can render activity per agent.
- Token usage rollup — the new `ui.modelPricing` setting (#219) needs
  per-call totals exposed so workstacean can compute cost per dispatch.
- Cancellation cleanliness — `AbortError` exists, but verify mid-run
  cancel actually drains in-flight model requests, background shells,
  and partial file writes.
- Working directory — `query()` should accept and respect a `cwd` so
  workstacean can dispatch into a protoMaker-owned worktree without
  `process.chdir()` side effects.
- Per-call model override — confirm `RunConfig.model` is honored when
  set per-skill.
- Error surface — typed error variants so workstacean can route timeout
  vs. tool-error vs. auth-failure to the right `skill.result` channel.

This is **active work**. Phase A and beyond are deferred behind it.

### Track 2 (deferred): Phase A — model-facing agent control

Still valuable: `send_message`, `event_monitor`, and an integrated
`task_stop` are tools the **model** uses to manage subagents it spawned.
That value holds whether proto is invoked from terminal or via SDK.

Two PRs, in order:

- **PR-1: housekeeping** (zero new behavior, pure reorganization)
  - Reconcile `task-stop.ts`. Our version (`config.getTaskStore()`,
    cascading task cancellation tied to Arena/Team) and upstream's
    (`config.getBackgroundTaskRegistry()`, single-task stop) collide on
    filename only. Since Arena/Team are unused in our workflow, drop
    ours and adopt upstream's.
  - Adopt upstream's `tools/agent/` nested directory layout. Our flat
    layout will keep stepping on every cherry-pick from this area.
- **PR-2: agent control tools**
  - Port #3471 (`send_message` + per-agent transcript).
  - Port #3684 (`event_monitor` with throttled streaming).
  - Skip #3687 — covered by PR-1.

Effort estimate: **medium**. With the housekeeping done first, the
content port should drop to ~10–14 hours rather than the 17–26 the
all-at-once probe suggested.

### Track 3 (dropped): Phase B TUI surface

Skip the bulk of upstream's TUI work (#3488 — pill, combined dialog,
detail view). It conflicts heavily with our crowded `StatusBar` /
`AppContainer` / `DialogManager`, and the audience for that polish
shrinks as workstacean owns the dashboard.

Keep open the option of porting **just `/tasks`** from #3642 as a
one-day spike if a terminal user explicitly asks. Otherwise, leave it.

### Track 4 (dropped): Phase C cross-session resume

Drop #3739 entirely. The premise — "user closes terminal mid-run" —
doesn't apply when workstacean is the orchestrator. SDK invocations
are short-lived per skill request. Workstacean replays from its own
bus event log if it restarts; proto's `background-store.json` doesn't
need to grow into a transcript checkpoint.

Reopen only if a real terminal user requests this.

---

## 5. Cross-cutting concerns

### Settings

Upstream's bg-agent settings have grown into their own block. We have an
`agents.*` section (Arena/Team/Swarm — unused in current workflow) plus
a flat `backgroundModel`. Before Track 2 PR-2 lands, decide whether to
nest under `agents.background.*` or keep flat. **Recommendation:** nest
with a back-compat read of `backgroundModel`.

### Stop-tool naming

Track 2 PR-1 resolves the `task-stop.ts` collision by dropping ours and
adopting upstream's. After that, `bg_stop` (shell-level) and `task_stop`
(task-level) coexist with distinct purposes — no further consolidation
needed unless upstream forces it.

### Persistence layout

`~/.proto/agents/background.json` stays as-is. Track 4 (cross-session
resume) is dropped, so the single-JSON shape is fine indefinitely.

### LiteLLM / gateway

Track 1 SDK surface work all flows through the gateway. Each PR that
touches the streaming path needs to be validated against `protolabs/fast`
and `protolabs/smart` before merging. **Recommendation:** add a gateway
smoke test once the Track 1 progress-event shape stabilizes.

---

## 6. Open questions for the team

1. **Do terminal users matter enough to keep `/tasks` (#3642) on the
   board?** The rest of upstream's TUI work is dropped; this slash
   command is a one-day spike if it does.
2. **At what point does Track 1 stabilize enough to start Track 2?**
   Heuristic: after 3+ workstacean-driven SDK PRs land without breaking
   the in-process executor, the surface is stable enough to layer
   agent-control tools on top.
3. **Track 2 PR-1 risk:** dropping our `task-stop.ts` removes the
   cascading-cancellation behavior used by Arena/Team. We have confirmed
   nobody is using those constructs today, but if that changes, the
   upstream version is a regression. Worth a one-line audit of any
   `getTaskStore()` callers before the rename PR ships.

---

## 7. Out of scope for this document

- Detailed code-level design for any single phase. That belongs in a
  follow-up doc per phase.
- Performance work on the existing registry. Today's footprint is fine;
  revisit if Phase C's persistence changes that.
- Anything about Arena, Team, or Swarm. Those are different agent
  systems that live alongside the background path; see
  `sub-agents-design.md`.

---

## Appendix: file inventory at time of writing

```
packages/core/src/
├── agents/
│   ├── background-store.ts        # 75 LOC, persistence
│   ├── runtime/agent-headless.ts  # headless execution
│   └── runtime/agent-interactive.ts
├── backgroundShells/
│   ├── registry.ts                # 126 LOC, central registry
│   ├── watcher.ts                 # 109 LOC, lifecycle
│   ├── diskOutput.ts              # 125 LOC, file capture
│   ├── notifications.ts           #  54 LOC, completion
│   └── types.ts                   #  44 LOC
├── tools/
│   ├── bg-stop.ts                 # 168 LOC, shell-level stop
│   ├── task-stop.ts               # agent-level stop
│   └── shell.ts                   # is_background: true entry point
└── utils/
    └── backgroundProgressEmitter.ts  # 190 LOC, event bus

packages/cli/src/ui/
├── commands/bgCommand.ts          #  84 LOC, /bg list
├── hooks/useBackgroundAgentProgress.ts  # 127 LOC
├── components/StatusBar.tsx        # active-agent count
└── AppContainer.tsx               # lastFinished hit-limit warnings
```

Last reviewed: 2026-05-03 (post-reframe; Track 1 active, Track 2 deferred, Tracks 3 + 4 dropped).
