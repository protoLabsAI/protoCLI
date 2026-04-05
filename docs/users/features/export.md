# Session Export

The `/export` command saves your current session to a file in your working directory. Four formats are supported.

## Usage

```
/export <format>
```

| Command         | Output                                             |
| --------------- | -------------------------------------------------- |
| `/export html`  | Self-contained HTML file with a rendered viewer    |
| `/export md`    | Markdown — plain text, readable anywhere           |
| `/export json`  | Structured JSON — one object per message           |
| `/export jsonl` | JSONL — one JSON object per line (stream-friendly) |

Files are written to the current working directory with a timestamped name, e.g. `export-2025-04-05T16-30-00-000Z.html`.

## HTML Format

The HTML export produces a **self-contained file** — no server, no internet connection required to view it. Open it directly in any browser.

It includes:

- Full conversation history with role labels (user / assistant / tool)
- Rendered markdown (code blocks, lists, headings)
- Tool call inputs and outputs collapsed by default
- A minimal, readable stylesheet baked in

This is useful for sharing a session with teammates, archiving a debugging session, or reviewing a long conversation outside the terminal.

## JSON / JSONL Formats

These formats expose the raw message structure, useful for:

- Piping into other tools (`jq`, scripts, LLM pipelines)
- Programmatic analysis of session content
- Building integrations on top of proto session data

`json` outputs a single array. `jsonl` outputs one JSON object per line, which is better for streaming and large files.

## Markdown Format

Exports the conversation as a readable `.md` file. Good for pasting into notes, wikis, or GitHub issues.

## Notes

- Export captures the session state at the moment the command runs — messages added after export are not included.
- The file is written to `config.workingDir` (the directory proto was started in).
- No session data is sent anywhere — the file is written locally only.
