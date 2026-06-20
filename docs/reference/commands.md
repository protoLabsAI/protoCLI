# Commands

Commands in proto fall into three categories based on their prefix.

## Slash commands (`/`)

### Session management

| Command              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `/init`              | Analyse current directory and create initial context file |
| `/summary`           | Generate project summary from conversation history        |
| `/compress`          | Replace chat history with summary to save tokens          |
| `/resume`            | Resume a previous conversation session                    |
| `/restore`           | Restore files to state before tool execution              |
| `/export`            | Export session to file (`html`, `md`, `json`, `jsonl`)    |
| `/recap`             | Print a "where we left off" card summarizing recent chat  |
| `/rewind` or `/undo` | Open rewind dialog to jump back to a previous turn        |
| `/rename` or `/tag`  | Rename the current conversation (auto-generates if empty) |
| `/delete`            | Delete a previous session                                 |

### Interface

| Command                              | Description                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| `/clear`                             | Clear terminal screen (`Ctrl+L`)                                    |
| `/context`                           | Show context window usage breakdown                                 |
| `/theme`                             | Change visual theme                                                 |
| `/vim`                               | Toggle Vim editing mode                                             |
| `/directory`                         | Manage multi-directory workspace                                    |
| `/editor`                            | Select preferred editor                                             |
| `/voice`                             | Toggle push-to-talk voice input on or off (persisted to settings)   |
| `/voice status`                      | Show voice input status: enabled state, STT endpoint, audio backend |
| `/bg list`                           | List long-running background shell tasks                            |
| `/btw`                               | Ask a quick side question without affecting the main conversation   |
| `/ide status` / `enable` / `disable` | Manage IDE companion integration                                    |
| `/docs`                              | Open full proto documentation in your browser                       |
| `/doctor`                            | Run installation and environment diagnostics                        |
| `/terminal-setup`                    | Configure terminal keybindings for multiline input                  |
| `/trust`                             | Manage folder trust settings                                        |

### Tools & models

| Command                                                | Description                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `/mcp`                                                 | Open MCP management dialog (list servers, tools, prompts)     |
| `/tools`                                               | List available tools                                          |
| `/skills [name]`                                       | List or invoke skills                                         |
| `/approval-mode <mode>`                                | Change approval mode (`plan`, `default`, `auto-edit`, `yolo`) |
| `/model`                                               | Switch model                                                  |
| `/model --fast <model>`                                | Set fast model for background tasks                           |
| `/model info` / `list`                                 | Show current model info or list available providers           |
| `/extensions manage` / `install` / `explore`           | Explore and manage extensions                                 |
| `/memory show` / `add` / `list` / `forget` / `refresh` | Manage memory (see also: `/memory proposals`)                 |
| `/memory proposals` / `accept` / `reject`              | Review and act on pending memory proposals                    |
| `/agents create`                                       | Guided sub-agent creation wizard                              |
| `/agents manage`                                       | View, edit, delete sub-agents                                 |
| `/team`                                                | Manage agent teams                                            |
| `/lsp status`                                          | Show LSP server status                                        |
| `/loop [interval] <prompt>`                            | Schedule a recurring prompt (e.g. `/loop 5m check deploy`)    |
| `/loop list` / `clear`                                 | List or cancel active loops                                   |
| `/goal <condition>`                                    | Set a completion condition; keep working until it holds       |
| `/goal clear` / `stop` / `off`                         | Cancel active goal                                            |
| `/setup-github`                                        | Set up GitHub Actions integration                             |

### Information & settings

| Command                                  | Description                                                      |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `/help` or `/?`                          | Display help                                                     |
| `/about` or `/status`                    | Display version information                                      |
| `/stats`                                 | Show session statistics (tokens, costs, cached tokens)           |
| `/notes` / `notes --view`                | View or refresh session notes (`.proto/session-notes.md`)        |
| `/insight status` / `enable` / `disable` | Show or toggle programming insights generation                   |
| `/settings`                              | Open settings editor                                             |
| `/setup`                                 | Reminder to run `proto setup` (wizard requires a fresh terminal) |
| `/auth`                                  | Change authentication method                                     |
| `/permissions`                           | Manage folder trust                                              |
| `/bug <description>`                     | Submit a bug report                                              |
| `/copy`                                  | Copy last output to clipboard                                    |
| `/quit` or `/exit`                       | Exit proto                                                       |

### Auth CLI subcommands (terminal, outside session)

| Command             | Description              |
| ------------------- | ------------------------ |
| `proto auth`        | Interactive auth setup   |
| `proto auth status` | Show current auth status |

### Setup CLI subcommand (terminal, outside session)

| Command       | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `proto setup` | Interactive wizard — configure a model provider, API key, default model |

See [Guides → Run the Setup Wizard](../guides/setup-wizard) for a full walkthrough.

### Agent CLI subcommands — A2A chat (terminal, outside session)

Talk to remote [A2A](../guides/a2a-agents) agents (such as protoAgent) from the terminal. Agents are registered under a shortcut name so you never retype URLs.

| Command                        | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `proto agents`                 | List registered and discovered A2A agents (with reachability)  |
| `proto agent <name>`           | Open an interactive chat with a registered or discovered agent |
| `proto agent add <name> <url>` | Register an agent under a shortcut name                        |
| `proto agent remove <name>`    | Unregister an agent                                            |
| `proto agent list`             | Same as `proto agents`                                         |
| `proto agent connect <name>`   | Same as `proto agent <name>`                                   |

`proto agents` / `proto agent list` accept `--no-scan` to skip network discovery and show only registered agents. `proto agent add` accepts `--scope user|project`, repeatable `-H, --header`, `--bearer-env`, `--api-key-env`, and `--description`. See [Guides → A2A Agents](../guides/a2a-agents) for the full walkthrough.

## `@` commands — inject files

| Form           | Description                                    |
| -------------- | ---------------------------------------------- |
| `@<file>`      | Inject content of a file into the conversation |
| `@<directory>` | Recursively read all text files in a directory |

Escape spaces in paths with backslash: `@My\ Documents/file.txt`.

## `!` commands — shell execution

| Form             | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `!<command>`     | Execute in a subshell                                    |
| `!` (standalone) | Toggle shell mode — all input goes directly to the shell |

Shell commands set `PROTO_CODE=1` in the environment.

## Custom commands

Save frequently-used prompts as slash commands.

- **Global commands**: `~/.proto/commands/<name>.md`
- **Project commands**: `.proto/commands/<name>.md`

Project commands take priority over global when names conflict.

Subdirectories create namespaced commands: `.proto/commands/git/commit.md` → `/git:commit`.

### File format

```markdown
---
description: Optional description shown in /help
---

Your prompt content here. Use {{args}} for parameter injection.
```

### Special syntax

| Syntax             | Effect                                            |
| ------------------ | ------------------------------------------------- |
| `{{args}}`         | Inject user-provided arguments                    |
| `@{file path}`     | Inject file content                               |
| `!{shell command}` | Execute and inject output (requires confirmation) |
