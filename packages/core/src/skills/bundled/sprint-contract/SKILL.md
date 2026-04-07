---
name: sprint-contract
description: Negotiate a sprint contract before coding — locks down exactly which files will be touched, what will change, and the acceptance criteria. Activates the scope lock to prevent scope creep.
---

# Sprint Contract

Produce an explicit, machine-readable sprint contract before writing any code.
The contract defines the permitted file set (scope lock), acceptance criteria,
and a sequenced implementation plan.

**Announce at start:** "I'm using the sprint-contract skill to negotiate the contract before coding."

## Process

1. **Read the task** — understand exactly what is being asked
2. **Explore** — use fff**grep and fff**find_files to locate relevant files; read key files to understand current state
3. **Identify the change surface** — determine the minimum set of files that must change
4. **Produce the contract** — output a JSON contract (see format below)
5. **Activate scope lock** — write the contract to `.proto/sprint-contract.json` so the harness can enforce the file set

## Contract Format

Output a JSON block with this exact structure:

```json
{
  "task": "one-sentence description of what will be built",
  "filesToCreate": ["/absolute/path/to/new/file.ts"],
  "filesToModify": ["/absolute/path/to/existing/file.ts"],
  "functionsToChange": {
    "/absolute/path/to/file.ts": ["functionName", "ClassName.methodName"]
  },
  "acceptanceCriteria": [
    "The X test passes",
    "Feature Y is accessible via Z",
    "No existing tests are broken"
  ],
  "implementationSequence": [
    "1. Add type definitions to types.ts",
    "2. Implement service in service.ts",
    "3. Wire into existing call site in client.ts",
    "4. Add tests"
  ],
  "risks": ["Changing X may affect Y — verify after"]
}
```

## Rules

- **Minimize scope**: only include files that genuinely need to change
- **Absolute paths**: all file paths must be absolute
- **No speculation**: only include files you have verified exist (via read or search)
- **Testable criteria**: each acceptance criterion must be objectively verifiable
- **Sequenced implementation**: order steps to minimize breakage (types → impl → tests)

## After the Contract

Write the JSON to `.proto/sprint-contract.json` in the project root.
Then report: "Sprint contract negotiated. Scope lock activated for N files."

The harness will automatically prevent edits to files outside the contract's file set.
