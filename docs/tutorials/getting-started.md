# Getting Started with proto

By the end of this tutorial you will have proto installed, connected to a model, and running your first agentic session in a real project.

## Before you begin

You need:

- A terminal (macOS, Linux, or Windows WSL)
- Node.js 20 or later — download from [nodejs.org](https://nodejs.org/en/download)
- A project directory to work in
- An API key for at least one model provider (OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint)

## Step 1: Install proto

```bash
npm install -g proto
```

Verify the installation:

```bash
proto --version
```

> [!note]
> Restart your terminal after installation if the `proto` command is not found.

### Optional: install the beads task tracker

proto integrates with `beads_rust` (`br`), a SQLite-backed per-project task tracker. Install it with Cargo:

```bash
cargo install beads_rust
```

See [Reference → Beads Task Tracker](../reference/beads) for full CLI documentation.

## Step 2: Run the setup wizard

The fastest way to get connected is the interactive setup wizard. From your terminal:

```bash
proto setup
```

It walks you through choosing a provider (OpenAI, Anthropic, Gemini, or any OpenAI-compatible / local endpoint), entering an API key, discovering the available models, picking a default, and optionally configuring voice input — then writes everything to `~/.proto/settings.json` for you. Re-run `proto setup` any time to switch providers or change the default model.

> [!tip]
> proto is local- and privacy-first: point the wizard at a local or self-hosted OpenAI-compatible endpoint (e.g. a local vLLM or Ollama-compatible server) to keep your code, keys, and context entirely on your machine.

If you start proto before configuring anything, it routes you straight into this wizard.

<details>
<summary>Prefer to configure by hand?</summary>

Add your provider to `~/.proto/settings.json` and export the key in your shell (do **not** put secrets directly in settings.json):

```json
{
  "modelProviders": {
    "openai": [{ "id": "gpt-4o", "name": "GPT-4o", "envKey": "OPENAI_API_KEY" }]
  }
}
```

```bash
export OPENAI_API_KEY=sk-...
```

For other providers — Anthropic, Gemini, gateways, or a local endpoint — see [Guides → Configure Models & Auth](../guides/configure-models).

</details>

## Step 3: Start your first session

Open a terminal in any project directory and start proto:

```bash
cd /path/to/your/project
proto
```

Since `proto setup` already picked your default model, you land straight in a session. Use `/model` at any time to switch.

## Step 4: Try your first prompts

Ask proto to explore the project:

```
what does this project do?
```

```
explain the folder structure
```

Ask it to make a change:

```
add a hello world function to the main file
```

proto will find the right file, show you the proposed edit, and ask for approval before writing anything.

## Step 5: Use Git with proto

```
what files have I changed?
```

```
commit my changes with a descriptive message
```

```
create a new branch called feature/hello-world
```

## Essential commands

| Command            | What it does                    |
| ------------------ | ------------------------------- |
| `proto`            | Start an interactive session    |
| `proto -p "..."`   | One-shot non-interactive mode   |
| `/help`            | List all slash commands         |
| `/model`           | Switch the active model         |
| `/auth`            | Change authentication           |
| `/compress`        | Compress history to save tokens |
| `/clear`           | Clear the screen (`Ctrl+L`)     |
| `/quit` or `/exit` | Exit proto                      |

See [Reference → Commands](../reference/commands) for the full list.

## Tips for effective sessions

**Be specific** — instead of "fix the bug", say "fix the login screen blank-page bug that appears after three failed attempts".

**Break down large tasks** — proto works best with focused requests. For complex work, describe one step at a time or use the [`coordinator` sub-agent](../guides/use-sub-agents).

**Let proto explore first** — before making changes, ask it to read and summarize the relevant code.

**Use approval mode** — by default proto asks before every file write. See [Guides → Approval Mode](../guides/approval-mode) to adjust this.

## Next steps

- [Build Your First Sub-Agent](./first-agent) — delegate tasks to specialized agents
- [Create Your First Skill](./first-skill) — package reusable expertise into a skill
- [Guides](../guides/) — task-oriented how-tos for MCP, hooks, headless mode, IDE integration, and more
