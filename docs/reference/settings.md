# Settings

proto is configured through JSON settings files combined with environment variables and command-line flags.

## Configuration layers (precedence, lowest → highest)

| Level | Source                                         | Scope                              |
| ----- | ---------------------------------------------- | ---------------------------------- |
| 1     | Hardcoded defaults                             | Built-in                           |
| 2     | System defaults file                           | All users on the machine           |
| 3     | User settings file (`~/.proto/settings.json`)  | Current user, all projects         |
| 4     | Project settings file (`.proto/settings.json`) | This project only                  |
| 5     | System settings file                           | All users (administrator override) |
| 6     | Environment variables / `.env` files           | Session                            |
| 7     | Command-line arguments                         | This invocation                    |

## Settings file locations

| File             | Location                                                             |
| ---------------- | -------------------------------------------------------------------- |
| User settings    | `~/.proto/settings.json`                                             |
| Project settings | `.proto/settings.json` (project root)                                |
| System defaults  | macOS: `/Library/Application Support/ProtoCode/system-defaults.json` |
| System overrides | macOS: `/Library/Application Support/ProtoCode/settings.json`        |

Override system file paths with `PROTO_SYSTEM_DEFAULTS_PATH` and `PROTO_SYSTEM_SETTINGS_PATH`.

> [!note]
> String values in `settings.json` support `$VAR` and `${VAR}` environment variable interpolation.

## Project directory (`.proto/`)

In addition to `settings.json`, the `.proto/` directory can contain:

- `.proto/agents/` — custom sub-agent definitions
- `.proto/skills/` — project skills
- `.proto/memory/` — project memory files
- `.proto/session-notes.md` — auto-maintained session checkpoint (updated by background agent after each turn; used as summary input when the context window is compacted)
- `.proto/settings.json` — project settings
- `.proto/sandbox-macos-custom.sb` — custom Seatbelt profile
- `.proto/sandbox.Dockerfile` — custom container image
- `.proto/verify-scenarios.json` — post-agent verification scenarios

## Available settings

### `general`

| Setting                                    | Type    | Default | Description                                                               |
| ------------------------------------------ | ------- | ------- | ------------------------------------------------------------------------- |
| `general.preferredEditor`                  | string  | —       | Editor for opening files                                                  |
| `general.vimMode`                          | boolean | `false` | Vim keybindings in input                                                  |
| `general.enableAutoUpdate`                 | boolean | `true`  | Check for updates on startup                                              |
| `general.gitCoAuthor`                      | boolean | `true`  | Add `Co-authored-by` trailer to git commits                               |
| `general.checkpointing.enabled`            | boolean | `false` | Session checkpointing for recovery                                        |
| `general.showSessionRecap`                 | boolean | `false` | Auto-generate one-line recap after idle (>5 min) on focus-in              |
| `general.sessionRecapAwayThresholdMinutes` | number  | `5`     | Minutes idle before auto-recap fires                                      |
| `general.debugKeystrokeLogging`            | boolean | `false` | Log keystrokes to console (for debugging)                                 |
| `general.terminalBell`                     | boolean | `true`  | Play terminal bell when response completes or needs approval              |
| `general.chatRecording`                    | boolean | `true`  | Save chat history to disk (required for `--continue` / `--resume`)        |
| `general.outputLanguage`                   | string  | `auto`  | LLM output language (`auto` or a language name like `Chinese`, `English`) |
| `general.defaultFileEncoding`              | string  | `utf-8` | Encoding for new files (`utf-8` or `utf-8-bom`)                           |
| `general.lsp`                              | boolean | —       | Enable LSP support globally (auto-enabled when `.lsp.json` exists)        |
| `general.language`                         | string  | auto    | UI language code (e.g. `en-US`, `zh-CN`)                                  |

### `output`

| Setting         | Type   | Default | Values         |
| --------------- | ------ | ------- | -------------- |
| `output.format` | string | `text`  | `text`, `json` |

### `ui`

| Setting                                 | Type    | Default | Description                           |
| --------------------------------------- | ------- | ------- | ------------------------------------- |
| `ui.theme`                              | string  | —       | Theme name or path to theme JSON file |
| `ui.customThemes`                       | object  | `{}`    | Custom theme definitions              |
| `ui.accessibility.enableLoadingPhrases` | boolean | `true`  | Show loading phrases                  |

### `model`

| Setting                                     | Type    | Default | Description                                |
| ------------------------------------------- | ------- | ------- | ------------------------------------------ |
| `model.name`                                | string  | —       | Default model ID to use on startup         |
| `model.generationConfig.enableCacheControl` | boolean | `true`  | Enable token caching                       |
| `model.generationConfig.timeout`            | number  | —       | Request timeout (ms)                       |
| `model.generationConfig.maxRetries`         | number  | —       | Max retries on failure                     |
| `model.generationConfig.samplingParams`     | object  | —       | `temperature`, `top_p`, `max_tokens`, etc. |

### Environment variable overrides

These variables take effect at runtime and do not require a settings file entry.

| Variable                        | Default  | Description                                                                                                                                                      |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROTO_STREAM_STALL_TIMEOUT_MS` | `300000` | Max ms to wait between streaming chunks before the stall watchdog fires (throws a retryable error). Increase if complex agentic responses are hitting the limit. |
| `PROTO_SYSTEM_DEFAULTS_PATH`    | —        | Override path to the system defaults settings file                                                                                                               |
| `PROTO_SYSTEM_SETTINGS_PATH`    | —        | Override path to the system settings override file                                                                                                               |

### `modelProviders`

Declare available models per auth type. See [Model Providers](./model-providers) for the full schema.

### `security`

| Setting                        | Type    | Default | Description                                                   |
| ------------------------------ | ------- | ------- | ------------------------------------------------------------- |
| `security.auth.selectedType`   | string  | —       | Active auth type on startup (`openai`, `anthropic`, `gemini`) |
| `security.folderTrust.enabled` | boolean | `false` | Enable the Trusted Folders security feature                   |

### `context`

Controls workspace discovery and file filtering.

| Setting                                           | Type     | Default | Description                                            |
| ------------------------------------------------- | -------- | ------- | ------------------------------------------------------ |
| `context.fileFiltering.respectGitIgnore`          | boolean  | `true`  | Respect `.gitignore` files when searching              |
| `context.fileFiltering.respectProtoIgnore`        | boolean  | `true`  | Respect `.protoignore` files                           |
| `context.fileFiltering.enableRecursiveFileSearch` | boolean  | `true`  | Enable recursive file search                           |
| `context.fileFiltering.enableFuzzySearch`         | boolean  | `true`  | Enable fuzzy search for files                          |
| `context.includeDirectories`                      | string[] | `[]`    | Additional directories to include in workspace context |
| `context.loadFromIncludeDirectories`              | boolean  | `false` | Load memory files from include directories             |
| `context.memoryConsolidation.minSessionsBetween`  | number   | `5`     | Min sessions between auto-consolidations               |
| `context.memoryConsolidation.minHoursBetween`     | number   | `24`    | Min hours between consolidations                       |
| `context.memoryConsolidation.minMemories`         | number   | —       | Min memories before consolidation triggers             |

### `permissions`

Permission rules controlling tool usage. Rules are evaluated in priority order: `deny` > `ask` > `allow`. Rules match tool class names (e.g. `ShellTool`) or glob patterns on tool arguments (e.g. `Bash(rm -rf *)`).

| Setting             | Type     | Default | Description                                      |
| ------------------- | -------- | ------- | ------------------------------------------------ |
| `permissions.allow` | string[] | `[]`    | Tools/commands auto-approved without prompt      |
| `permissions.ask`   | string[] | `[]`    | Tools/commands always requiring confirmation     |
| `permissions.deny`  | string[] | `[]`    | Tools/commands always blocked (highest priority) |

The legacy `confirmShellCommands` and `confirmFileEdits` booleans are deprecated in favor of `permissions.ask` rules.

### `tools`

| Setting                              | Type           | Default | Description                                                             |
| ------------------------------------ | -------------- | ------- | ----------------------------------------------------------------------- |
| `tools.sandbox`                      | boolean/string | `false` | Enable sandboxing (`true`, `false`, `docker`, `podman`, `sandbox-exec`) |
| `tools.shell.pager`                  | string         | `cat`   | Pager command for shell output                                          |
| `tools.shell.enableInteractiveShell` | boolean        | `true`  | Use node-pty for interactive shell (falls back to child_process)        |
| `tools.shell.showColor`              | boolean        | `false` | Show color in shell output                                              |
| `tools.verifyCommand`                | string         | —       | Shell command run after each edit for verification                      |

### `agents`

Settings for multi-agent collaboration features.

| Setting              | Type   | Default      | Description                              |
| -------------------- | ------ | ------------ | ---------------------------------------- |
| `agents.displayMode` | string | `in-process` | Display mode (`in-process` only for now) |

### `telemetry`

Observability configuration. Set `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` to activate tracing.

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |

### `webSearch`

| Setting              | Type   | Description               |
| -------------------- | ------ | ------------------------- | -------- | --------------------------------------- |
| `webSearch.provider` | array  | Array of `{type: "tavily" | "google" | "dashscope", apiKey?, searchEngineId?}` |
| `webSearch.default`  | string | Default provider name     |

### `slashCommands`

Lock down or hide slash commands in multi-tenant deployments.

| Setting                  | Type     | Default | Description                                    |
| ------------------------ | -------- | ------- | ---------------------------------------------- |
| `slashCommands.disabled` | string[] | `[]`    | Slash command names to hide (case-insensitive) |

### `mcpServers`

Map of MCP server configurations. See [Guides → Connect via MCP](../guides/use-mcp) for the full schema.

### `mcp`

| Setting        | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `mcp.allowed`  | string[] | Allowlist of MCP server names |
| `mcp.excluded` | string[] | Denylist of MCP server names  |

### `voice`

| Setting             | Type    | Default                                         | Description                                                                                                          |
| ------------------- | ------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `voice.enabled`     | boolean | `false`                                         | Enable push-to-talk voice input (Ctrl+Space)                                                                         |
| `voice.sttEndpoint` | string  | `http://localhost:8000/v1/audio/transcriptions` | OpenAI-compatible STT endpoint URL                                                                                   |
| `voice.sttEnvKey`   | string  | —                                               | Name of an environment variable whose value is used as `Authorization: Bearer <value>` when calling the STT endpoint |

See [Guides → Voice Input](../guides/voice-input) for setup instructions and prerequisites.

### `experimental`

| Setting             | Type    | Default | Description            |
| ------------------- | ------- | ------- | ---------------------- |
| `experimental.cron` | boolean | `false` | Enable scheduled tasks |

### `env`

Map of environment variable names to values. Lowest-priority API key fallback. **Do not commit secrets.**

### `hooks`

Hook event configuration. See [Guides → Use Hooks](../guides/use-hooks) for the full schema.

### `disableAllHooks`

| Setting           | Type    | Default | Description                                     |
| ----------------- | ------- | ------- | ----------------------------------------------- |
| `disableAllHooks` | boolean | `false` | Disable all hooks without deleting their config |

## Configuration migration

Legacy `disable*` settings are automatically migrated to `enable*` names. Old files are backed up before migration.
