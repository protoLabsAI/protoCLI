# Ask User Question (`ask_user_question`)

Asks the user one or more structured questions during execution. Useful for gathering preferences, clarifying requirements, or getting decisions on implementation choices.

## Parameters

| Parameter   | Required | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| `questions` | Yes      | Array of question objects (max 4 questions) |

Each question object:

| Field         | Required | Description                                        |
| ------------- | -------- | -------------------------------------------------- |
| `question`    | Yes      | The full question text, ending with `?`            |
| `header`      | No       | Short label displayed as a chip/tag (max 30 chars) |
| `options`     | Yes      | Array of 2–4 answer choices                        |
| `multiSelect` | No       | Allow multiple answers (default: `false`)          |

Each option:

| Field         | Required | Description                             |
| ------------- | -------- | --------------------------------------- |
| `label`       | Yes      | Display text for the choice (1–5 words) |
| `description` | No       | Explanation of what this option means   |

## Usage notes

- Users can always select "Other" to provide custom text input.
- If you recommend a specific option, make it the first in the list and add "(Recommended)" at the end of the label.
- The `questions` parameter is a real array — do NOT JSON-encode it as a string.

## See Also

- [Explanation → Agent Harness](../../explanation/agent-harness) — When to use this tool in the agentic workflow
