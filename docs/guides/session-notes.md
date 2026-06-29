# Session Notes

proto maintains a running summary of each session in `.proto/session-notes.md`.
A background agent updates it after every turn, and compaction reuses it as
the summary seed so context survives across a long, multi-turn build.

## What it is

`session-notes.md` is a structured, sectioned record of what happened in the
current session. It is written and maintained entirely by a restricted
background agent — you don't edit it directly. The sections are:

| Section                    | Purpose                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| **Session Title**          | A short, distinctive title for the session                                                |
| **Current State**          | Where things stand right now — the most important section for continuity after compaction |
| **Task Specification**     | What was asked for and acceptance criteria                                                |
| **Workflow**               | Bash commands usually run and in what order                                               |
| **Files and Functions**    | Which files and functions were touched or are relevant                                    |
| **Codebase Documentation** | Important system components, how they work, and how they fit together                     |
| **Errors and Corrections** | Problems hit and how they were resolved; approaches that failed and must not be retried   |
| **Key Results**            | Specific outputs (answers, tables, documents) repeated verbatim                           |
| **Learnings**              | Insights that apply beyond this session                                                   |
| **Worklog**                | Chronological record of significant actions                                               |

Each section has a header line and an italic description line — the background
agent preserves both exactly and only updates the content below.

## How it works

After each conversation turn, `firePostTurnBackground()` fires three
fire-and-forget passes:

1. **Session-memory checkpoint** — the agent reads recent history and edits
   `session-notes.md` in place.
2. **Memory consolidation** — project-memory proposals from recent messages.
3. **Skill evolution** — reusable workflow patterns drafted as `SKILL.md`
   candidates.

The session-memory pass is internally gated:

| Gate                          | Default  | Purpose                                                                  |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `enabled`                     | `true`   | Toggle the feature on/off                                                |
| `minimumTokensToInit`         | `10,000` | First extraction fires only after the context window exceeds this        |
| `minimumTokensBetweenUpdates` | `5,000`  | Subsequent extractions require this much token growth since the last one |

When compaction later fires, proto uses the notes file as the summary input
instead of making a fresh LLM summarization call. This preserves the thread
of the conversation even when the context window is compressed.

## The background agent

The extraction agent is a restricted `AgentHeadless` instance named
`session-memory`. It is visible in the background agents panel as **notes**
with a `↺` icon:

```
↺ notes: writing
↺ notes: turn 2
```

It is restricted to the `edit` tool only — it cannot read files, run shells,
or touch anything outside `session-notes.md`. Its budgets are:

- **Max turns:** 4 (generous — the agent receives notes + history in its
  system prompt, so no read turn is needed)
- **Max time:** 3 minutes (an `AbortSignal` cancels hanging model calls)
- **Token budget:** ~12,000 tokens total, ~2,000 per section (oversized
  sections are condensed with a warning in the prompt)

If extraction fails for any reason, it is non-fatal — the session continues
normally and the next turn retries.

## Viewing and refreshing

Use the `/notes` slash command:

| Command         | Effect                                             |
| --------------- | -------------------------------------------------- |
| `/notes`        | Trigger a fresh extraction, then display the notes |
| `/notes --view` | Display the current notes without re-extracting    |

The command bypasses the token-threshold gates and forces an immediate
extraction, useful when you want to see the latest state mid-session.

## Configuration

Session memory is configured under `sessionMemory` in your settings:

```json
{
  "sessionMemory": {
    "enabled": true,
    "minimumTokensToInit": 10000,
    "minimumTokensBetweenUpdates": 5000
  }
}
```

These map to the `SessionMemorySettings` interface in the core config.
Set `enabled: false` to disable the background extraction entirely.

## Relationship to memory

Session notes and the [memory system](./manage-memory) serve different purposes:

|                | Session Notes                        | Memory                                    |
| -------------- | ------------------------------------ | ----------------------------------------- |
| **File**       | `.proto/session-notes.md`            | `.proto/memory/*.md`                      |
| **Lifespan**   | Per-session (reset each new session) | Persistent across sessions                |
| **Content**    | Structured summary of current work   | Durable facts about you and your projects |
| **Updated by** | Background extraction agent          | `save_memory` tool + auto-extraction      |
| **Used by**    | Compaction as summary seed           | Loaded into system prompt every session   |

Session notes are a short-horizon continuity mechanism; memory is the
long-horizon one. Both feed into proto's ability to maintain context across
a long conversation.
