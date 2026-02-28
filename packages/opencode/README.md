# Ava CLI (protoCli)

Ava is an AI-powered developer agent built on top of [opencode](https://opencode.ai). It integrates with the **Automaker** platform to provide agentic development workflows, task tracking, and structured feature delivery.

## Installation

```bash
curl -fsSL https://github.com/anomalyco/protocli/releases/latest/download/install | bash
```

Or install a specific version:

```bash
curl -fsSL https://github.com/anomalyco/protocli/releases/latest/download/install | bash -s -- --version 1.2.15
```

Or install from a local binary:

```bash
./install/ava --binary /path/to/ava
```

Ava installs to `~/.ava/bin/ava` and adds itself to your `$PATH` automatically.

## First-Run Setup

1. Open your project directory:

   ```bash
   cd <your-project>
   ```

2. Launch Ava:

   ```bash
   ava
   ```

3. On first run, Ava will prompt you to configure your AI provider. You can use any supported provider (Anthropic, OpenAI, etc.).

## Automaker Connection

Ava connects to the **Automaker** platform to receive feature tasks and report progress. To configure the connection, set the following environment variables or add them to your shell profile:

```bash
# Automaker API endpoint (default: https://automaker.anomalyco.com)
export AUTOMAKER_URL=https://automaker.anomalyco.com

# Your Automaker API key (from your Automaker dashboard)
export AUTOMAKER_API_KEY=<your-api-key>
```

Alternatively, you can configure these in your project's `ava.config.ts` or in the interactive setup when running `ava` for the first time.

## Building from Source

Requires [Bun](https://bun.sh) v1.3+.

```bash
# Install dependencies
bun install

# Build the ava binary for the current platform
bun run build -- --single
```

The binary will be output to `dist/protocli-<os>-<arch>/bin/ava`.

To build all platforms:

```bash
bun run build
```

## Repository

- GitHub: https://github.com/anomalyco/protocli
- Issues: https://github.com/anomalyco/protocli/issues
