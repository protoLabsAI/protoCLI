# Language Server Protocol (`lsp`)

Provides code intelligence via the Language Server Protocol. Supports definitions, references, hover, symbols, call hierarchy, diagnostics, and code actions.

## Operations

| Operation              | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `goToDefinition`       | Jump to symbol definition                                  |
| `findReferences`       | Find all references to a symbol                            |
| `hover`                | Show type info, documentation, and signature at a location |
| `documentSymbol`       | List symbols in a file                                     |
| `workspaceSymbol`      | Search for symbols across the workspace                    |
| `goToImplementation`   | Jump to symbol implementation                              |
| `prepareCallHierarchy` | Prepare call hierarchy at a location                       |
| `incomingCalls`        | Show callers of a function                                 |
| `outgoingCalls`        | Show functions called by a function                        |
| `diagnostics`          | Show diagnostics for a specific file                       |
| `workspaceDiagnostics` | Show diagnostics across the entire workspace               |
| `codeActions`          | Get available code actions (quickfix, refactor, etc.)      |

## Parameters

| Parameter      | Required | Description                                                      |
| -------------- | -------- | ---------------------------------------------------------------- |
| `operation`    | Yes      | The LSP operation to perform (see table above)                   |
| `filePath`     | No       | Absolute or workspace-relative file path                         |
| `line`         | No       | 1-based line number for location-targeted operations             |
| `character`    | No       | 1-based character/column number for location-targeted operations |
| `endLine`      | No       | 1-based end line for range-based operations                      |
| `endCharacter` | No       | 1-based end character for range-based operations                 |
| `query`        | No       | Symbol query for workspace symbol search                         |
| `serverName`   | No       | Optional LSP server name to target                               |
| `limit`        | No       | Optional maximum number of results to return                     |

Location-targeted operations (`goToDefinition`, `findReferences`, `hover`, `goToImplementation`, `prepareCallHierarchy`) require `filePath` + `line` + `character`.

Range-based operations (`diagnostics`, `codeActions`) require `filePath` and optionally `line`/`endLine`.

## See Also

- [Guides → Language Server Protocol](../../guides/use-lsp) — Setup and configuration
