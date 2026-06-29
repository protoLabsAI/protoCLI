# Repository Map (`repo_map`)

Returns a PageRank-ranked map of the most relevant source files in the repository. Analyzes import graphs to surface files most likely needed for a task.

## Parameters

| Parameter   | Required | Description                                                                            |
| ----------- | -------- | -------------------------------------------------------------------------------------- |
| `seedFiles` | No       | Absolute paths to files already known to be relevant (seeds for personalized PageRank) |
| `topN`      | No       | Maximum number of files to return (default: 20, max: 50)                               |

## Behavior

- Without `seedFiles`, returns the globally most-connected files in the repository.
- With `seedFiles`, returns files personalized to those seeds — files imported by or that import the seeds rank higher.
- Returns file paths with their exported symbol names.

## When to use

- When starting a new task and you need to understand the repository structure.
- When you need to find files related to a specific feature or component.
- As a faster alternative to manual file searching for understanding codebase layout.
