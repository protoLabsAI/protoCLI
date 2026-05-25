# Memory

proto's memory system persists facts across sessions using a file-per-memory architecture with YAML frontmatter.

## Memory types

| Type        | What it stores                                                      |
| ----------- | ------------------------------------------------------------------- |
| `user`      | Role, goals, preferences, knowledge level                           |
| `feedback`  | How proto should approach work — corrections and confirmed patterns |
| `project`   | Ongoing work, decisions, deadlines not derivable from code          |
| `reference` | Pointers to external systems (Linear, Grafana, Slack)               |

## Memory locations

| Scope   | Location           | Loaded when              |
| ------- | ------------------ | ------------------------ |
| Global  | `~/.proto/memory/` | Every session            |
| Project | `.proto/memory/`   | Sessions in this project |

## `MEMORY.md` index

A `MEMORY.md` index file is auto-generated in each memory directory and loaded into the system prompt at session start.

## Memory file format

```markdown
---
name: feedback-name
type: feedback
scope: project
createdAt: 2026-04-07T10:00:00Z
---

Always run `npm run preflight` before marking a task complete.
```

The `name` field (kebab-case, unique within its scope) is used for identification in commands like `/memory forget`. If omitted, the filename stem is used instead.

## Session commands

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `/memory show`          | Display all loaded memory content        |
| `/memory list`          | List all memories with metadata          |
| `/memory add <fact>`    | Save a new memory (interactive prompt)   |
| `/memory forget <name>` | Delete a memory by name or filename      |
| `/memory refresh`       | Reload memories from disk                |
| `/memory proposals`     | List pending memory proposals for review |
| `/memory accept <id>`   | Accept a proposal; moves it into memory  |
| `/memory reject <id>`   | Reject and delete a proposal             |

## Proposals workflow

Extracted memories are not auto-committed — they land in a `proposals/` subdirectory first. This lets you review before they affect agent behavior.

**Proposal file format** (`{memoryDir}/proposals/{type}_{name}.md`):

```markdown
---
name: short-kebab-name
type: user|feedback|project|reference
---

The memory content.
```

**Workflow:**

1. After a session ends, the extractor agent writes proposals to `proposals/` (runs fire-and-forget)
2. Run `/memory proposals` to review pending items with age and content preview
3. `/memory accept <id>` — moves the file to the memory directory and regenerates the index
4. `/memory reject <id>` — deletes the proposal file

Proposals are checked against existing memories to avoid duplicates before extraction.

## Staleness

Memories can go stale. Warnings are shown in `/memory list` output:

| Type        | Staleness threshold |
| ----------- | ------------------- |
| `user`      | Never stale         |
| `feedback`  | Never stale         |
| `project`   | ~21 days            |
| `reference` | ~7 days             |

Stale memories display a reminder to verify their accuracy before acting on them.

## Auto-consolidation

On session end, if all gates pass (≥5 sessions and ≥24 hours since last consolidation), the consolidation service:

1. Prunes memories older than 90 days
2. Runs LLM deduplication — groups semantically similar memories and merges them into one
3. Regenerates the `MEMORY.md` index

Consolidation respects `context.memoryConsolidation.*` thresholds.

## Auto-extraction

After each session turn, a background extraction agent reviews recent messages and automatically saves facts worth remembering. Review what was saved with `/memory list`.

## Context files (`PROTO.md`, `AGENTS.md`)

In addition to the memory system, proto loads static context files from the project root:

- `PROTO.md` — project context injected into every session
- `AGENTS.md` — additional agent guidelines (also loaded if present)

These files are for architectural context and conventions. Use `PROTO.md` for project-level instructions and the memory system for dynamic, evolving facts.

## What to save (and what not to)

**Save:**

- User preferences and working style
- Approach corrections ("always run X before committing")
- Project decisions not in the code ("we use pnpm, not npm")
- Pointers to external systems

**Do not save:**

- Code patterns or architecture (read the code)
- Git history (use `git log`)
- Debugging solutions (the fix is in the code)
- In-progress task details
