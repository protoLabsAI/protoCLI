# Background Agents — Design & Roadmap

A maintainer-oriented map of the **background-agent** subsystem in protoCLI:
what is already wired, what is intentionally deferred, and how we plan to
close the gap with upstream `qwen-code`.

The goal of this document is not to specify a feature — much of the
infrastructure already exists. It is to give us a single pass at the
**shape** of the work so we can sequence the next set of ports without
re-reading the upstream diff every time.

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

## 4. Proposed phasing

The dependency chain suggests three phases. Each phase is a single PR
unless noted; each is sized to stay under the "path of least resistance"
bar we have been holding for the rest of this fork's port work.

### Phase A — model can talk to its running agents

Land the upstream agent-control surface so the model has a real grammar
for managing background work.

- **Port #3471** (model-facing agent control): `send_message` + per-agent
  transcript. Reconcile with our existing `task-stop.ts`.
- **Port #3687** (unify shells into task_stop): collapse `bg_stop` into
  `task_stop` if it doesn't break our tool registry expectations. If it
  does, keep both and document the split.
- **Port #3684** (event monitor tool with throttled streaming): adds the
  primary mechanism the parent uses to actually consume subagent output.

Risk: our `BackgroundShellRegistry` and upstream's task-pool shape may
have diverged. Expect a non-trivial reconciliation in the registry's
public methods.

Effort estimate: **medium-large**. Two cherry-picks plus a glue PR.

### Phase B — user can see what's happening

Once the model has a control surface, expose it.

- **Port #3488** (UI: pill, combined dialog, detail view). This will
  conflict heavily with our existing StatusBar + AppContainer because we
  have our own pill there for `lastFinished`. Resolve by keeping our hook
  shape and only adopting upstream's components where they don't depend
  on un-ported state.
- **Port #3642** (`/tasks` command). Decision: replace `/bg list` with
  `/tasks`, or keep both and have `/bg` alias to `/tasks`?

Risk: TUI churn. Snapshot tests will break. Voice / recap state has to
keep working in the same component tree.

Effort estimate: **medium**. One UI PR plus the slash-command PR.

### Phase C — agents survive session boundaries

The headline upstream feature.

- **Port #3739** (resume / continuation): persist enough agent state on
  disk so a freshly-started session can re-attach to running agents. Our
  `background-store.ts` already persists _that_ an agent ran; this PR
  extends it to the agent's transcript and pending tool calls.

Risk: this touches `chatRecordingService` and `sessionService`. Both
have local divergence. Expect a careful merge.

Effort estimate: **large**. Likely the biggest single port left.

---

## 5. Cross-cutting concerns

### Settings

Upstream's bg-agent settings have grown into their own block. We already
have an `agents.*` section (Arena/Team/Swarm) plus a flat `backgroundModel`.
Before Phase A lands, decide whether to nest under `agents.background.*`
or keep flat. **Recommendation:** nest, and migrate `backgroundModel` to
`agents.background.model` with a back-compat read.

### Naming

We have **two** stop tools: `bg_stop` (shell) and `task_stop` (agent).
Upstream is collapsing these. Pick a direction now so Phase A doesn't
have to revisit it. **Recommendation:** keep the split until Phase A's
`#3687` port forces the unification — premature consolidation rarely
pays off in this codebase.

### Persistence layout

`~/.proto/agents/background.json` is shared by anything that wants to
remember an agent existed. If Phase C extends it to full transcripts, we
should move from a single JSON to a directory-of-files layout to avoid
rewriting hundreds of KB on every checkpoint. **Recommendation:** keep
the simple JSON until Phase C makes it actually painful.

### LiteLLM / gateway

All agent control surfaces assume the standard generate-content path.
Our gateway layer has its own quirks (thinking-tag stripping, max_tokens
ceilings). Validate Phase A against `protolabs/fast` and `protolabs/smart`
before merging. **Recommendation:** add a smoke test that runs a
background subagent with the gateway in CI.

---

## 6. Open questions for the team

1. **Do we need `/tasks` as a name, or is `/bg` good enough?** Aliasing
   is cheap; choosing the wrong primary name and renaming later is not.
2. **Should the per-agent detail view be a dialog or a separate route?**
   Upstream picks dialog. Our DialogManager already has 8+ dialogs and
   is starting to feel crowded.
3. **Cross-session resume scope:** do we attempt to resume _any_
   interrupted agent, or only those flagged as resumable? The latter is
   safer; the former is what the headline feature looks like.
4. **SDK surface:** upstream's task-event SDK exposes a public API for
   third-party tools to subscribe. We have no SDK consumers today. Worth
   the maintenance cost to port the surface, or strip it on the way in?

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

Last reviewed: 2026-05-02 (before Phase A planning).
