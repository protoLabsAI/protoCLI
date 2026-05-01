# Telemetry & Observability

proto is built on [OpenTelemetry](https://opentelemetry.io/) — the vendor-neutral observability standard. All traces, spans, and metrics use OTLP format and can be exported to any compatible backend.

## Opt-in by default

**No telemetry leaves the host until you explicitly enable it.** This is true for every exporter — OTLP, Langfuse, file output. Set:

```json
{ "telemetry": { "enabled": true } }
```

in `settings.json`, or pass `--telemetry` on the CLI. Without that flag, nothing is sent anywhere — even if Langfuse env vars are present.

## Default ingress: `otel.proto-labs.ai`

When opted in, traces ship to the homelab LGTM stack at `https://otel.proto-labs.ai` over OTLP/HTTP. The endpoint is bearer-token authenticated:

```json
{
  "telemetry": { "enabled": true },
  "env": {
    "OTEL_INGRESS_TOKEN": "<token from Infisical homelab-media/prod>"
  }
}
```

Without `OTEL_INGRESS_TOKEN`, the ingress returns 401 (debug-logged in `~/.proto/debug/latest`).

## Langfuse (LLM-grade trace UI)

Langfuse is wired in addition to the LGTM stack — keeps prompt-grade trace debugging available alongside Tempo's APM views. Activate by setting all of these in `settings.json` `env`:

```json
{
  "telemetry": { "enabled": true },
  "env": {
    "LANGFUSE_PUBLIC_KEY": "pk-lf-...",
    "LANGFUSE_SECRET_KEY": "sk-lf-...",
    "LANGFUSE_BASE_URL": "https://your-langfuse-instance.example.com"
  }
}
```

`LANGFUSE_BASE_URL` is optional; defaults to `https://cloud.langfuse.com`.

What's traced:

- Every session turn
- All LLM calls (all providers) with token counts
- Tool calls with input/output
- Sub-agent spawns and completions
- Model reasoning content as `gen_ai.response.thinking` span attribute (when surfaced by the model or gateway)

## Configuration reference

| Setting                  | Env var                    | CLI flag                            | Values          | Default                           |
| ------------------------ | -------------------------- | ----------------------------------- | --------------- | --------------------------------- |
| `telemetry.enabled`      | `PROTO_TELEMETRY_ENABLED`  | `--telemetry` / `--no-telemetry`    | `true`/`false`  | `false` _(opt-in)_                |
| `telemetry.target`       | `PROTO_TELEMETRY_TARGET`   | `--telemetry-target <local\|otel>`  | `local`, `otel` | `local`                           |
| `telemetry.otlpEndpoint` | `PROTO_TELEMETRY_ENDPOINT` | `--telemetry-otlp-endpoint <url>`   | OTLP URL        | `https://otel.proto-labs.ai`      |
| `telemetry.otlpProtocol` | —                          | `--telemetry-otlp-protocol <proto>` | `http`, `grpc`  | `http`                            |
| `telemetry.logPrompts`   | —                          | `--telemetry-log-prompts`           | `true`/`false`  | `true`                            |
| `OTEL_INGRESS_TOKEN`     | —                          | —                                   | bearer token    | — (required for default endpoint) |

### File-based local output

For local-only debugging without shipping anywhere:

```json
{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "outfile": "~/.proto/telemetry/traces.jsonl"
  }
}
```

### Override to a different OTLP backend

If you run a local OTel Collector or want to point at a different vendor:

```json
{
  "telemetry": {
    "enabled": true,
    "otlpEndpoint": "http://localhost:4318",
    "otlpProtocol": "http"
  }
}
```

For a local gRPC collector, set `otlpProtocol: "grpc"` and use port `4317`.

## What is instrumented

- **Session turns** — user prompt, model response, duration
- **LLM calls** — provider, model, input/output/thinking tokens, latency, reasoning content
- **Tool calls** — name, arguments, result, duration
- **Sub-agent lifecycle** — spawn, completion, token usage
- **Harness interventions** — doom loop detection, multi-sample retries
- **Hook executions** — which hook fired, success, duration, exit code, captured stdout/stderr

## Privacy

The opt-in default means privacy is the baseline — silence unless you say otherwise. When opted in:

- `telemetry.logPrompts` controls whether prompt content + reasoning text are attached to spans (default `true`).
- Reasoning text and completion content are truncated at 10K chars on each span.
- For production deployments shipping to shared infra, configure sampling/filtering at the OTel Collector layer.
- Local sandboxed runs default to a per-process session ID; no stable user identifier is exported.
