# Skill (`skill`)

Invokes a skill by name. Skills package reusable expertise into discoverable capabilities — each is a directory containing a `SKILL.md` file with YAML frontmatter and instructions.

## Parameters

| Parameter | Required | Description                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------ |
| `skill`   | Yes      | The skill name (no arguments). E.g., `"pdf"`, `"xlsx"`, `"browser-automation"` |

## How it works

1. proto loads the skill definition from its discovery path (project → user → extension → bundled).
2. The skill's `SKILL.md` body is injected into the conversation as context.
3. The model follows the skill's instructions to complete the task.

## Skill locations

| Level     | Path                                |
| --------- | ----------------------------------- |
| Project   | `.proto/skills/`                    |
| User      | `~/.proto/skills/`                  |
| Extension | Installed extension's `skills/` dir |
| Bundled   | Shipped with proto                  |

## Bundled skills

| Skill                | Description                             |
| -------------------- | --------------------------------------- |
| `browser-automation` | Browser automation workflows            |
| `harness-reference`  | Agent harness safety features reference |
| `proto-helper`       | protoCLI usage helper                   |
| `review`             | Code review workflows                   |

## See Also

- [Guides → Use Skills](../../guides/use-skills) — Create and manage skills
- [Explanation → Skills Design](../../explanation/skills-design) — Architecture and design
