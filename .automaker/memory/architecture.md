---
tags: [architecture]
summary: architecture implementation decisions and patterns
relevantTo: [architecture]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 0
  referenced: 0
  successfulFeatures: 0
---
# architecture

### Database filename (ava.db) is a user-visible identity marker stored in ~/.local/share/ and must be updated as part of application rename, even though database files are typically internal implementation details (2026-02-28)
- **Context:** Feature requires renaming app from 'opencode' to 'ava' across filesystem identity (binary, config paths, CLI output, database files)
- **Why:** User-facing filesystem paths like ~/.local/share/ava/ava.db expose the app identity. Mismatch between app name and db filename creates user confusion (mixed identities in home directory). Database filename is part of the user experience, not just internal plumbing
- **Rejected:** Alternative: Keep db filename as 'opencode.db' to minimize code changes. Rejected because it violates the identity consistency requirement - users see 'ava' in CLI but 'opencode.db' on disk
- **Trade-offs:** Wider scope of required changes (had to modify db.ts which wasn't in original file list) vs. cleaner user experience (consistent app identity in filesystem)
- **Breaking if changed:** If database filename isn't updated: users see mixed app identities in ~/.local/share/ (dir named 'ava', file named 'opencode.db'), violating user-visible consistency

#### [Pattern] Single centralized app identity constant (const app = 'ava' in src/global/index.ts) drives multiple XDG filesystem paths via library dependencies, creating DRY pattern for app identity (2026-02-28)
- **Problem solved:** App requires config in ~/.config/ava/ and data in ~/.local/share/ava/. Both paths must reference the same app name. If renamed, all paths must follow
- **Why this works:** Single source of truth for app identity ensures rename is atomic across all XDG paths. Library (likely xdg-base-dirs) uses this constant to generate paths. Avoids hardcoding multiple path strings that can drift
- **Trade-offs:** Easier to rename (one variable change) but requires understanding XDG library behavior and that 'app' constant controls paths. Less explicit than hardcoded paths

#### [Gotcha] Binary launcher (bin/ava) contains hardcoded app identity references (AVA_BIN_PATH env var, .ava cache directory, ava-{platform}-{arch} package names) that must stay in sync with source code renaming, creating hidden cross-file dependency (2026-02-28)
- **Situation:** The bin/ script is executable glue code that runs before main app code. It caches and launches native binaries, so it needs to reference the app name in multiple places
- **Root cause:** Binary launcher must independently resolve and cache the compiled native binary. It can't import from TypeScript source to learn the app name, so it hardcodes references. This is necessary for bootstrapping before the main app loads
- **How to avoid:** Simple launcher code that works as pure script vs. synchronization burden: renaming app requires changes in two separate file types (TypeScript src AND shell script bin/)

### Only user-visible identity changed (CLI name, XDG paths, db filename); internal implementation details left unchanged (OPENCODE env var, log messages with 'opencode' text) (2026-02-28)
- **Context:** Feature description required renaming from 'opencode' to 'ava'. Decision: which references need to change?
- **Why:** Minimize breaking changes and code surface area. User-visible identity (what CLI shows, what files appear in home dir) must be consistent. Internal markers (env vars, log text) don't affect user experience and changing them creates larger refactoring surface
- **Rejected:** Alternative: Complete codebase rename - change every 'opencode' reference. Rejected because it expands scope significantly and internal details don't affect acceptance criteria (CLI help shows 'ava', data stored correctly, etc.)
- **Trade-offs:** Smaller, faster changes vs. incomplete terminology (logs still say 'opencode' internally, creating code reading confusion). Users see correct identity but developers see mixed terminology
- **Breaking if changed:** If internal markers were changed inconsistently (e.g., only env var but not logs): code becomes harder to debug (inconsistent terminology in output), though functionality isn't broken

### Agent definition file (agent.ts) serves dual purpose: configuration AND security policy enforcement via tool permission denials (2026-02-28)
- **Context:** Ava agent needed restricted tool access (no edit/write/apply_patch) while other agents have full access
- **Why:** Keeps all agent capabilities and constraints colocated—single source of truth. Permission model is declarative in agent definition, not scattered across middleware/hooks
- **Rejected:** Separate permission middleware layer that checks agent name at runtime and denies tools—would require request-time security checks and duplicate capability logic elsewhere
- **Trade-offs:** Easier to see full agent capability set at a glance; harder to reuse permission rules across similar agents without duplication; security depends on agent.ts being correct
- **Breaking if changed:** If permission checks are moved to middleware layer, all tool-denial configurations become orphaned and grants unintended access

#### [Pattern] Default agent selection emerges implicitly from list() sort order (alphabetical priority to 'ava') rather than explicit default_agent field (2026-02-28)
- **Problem solved:** Ava needed to be the primary agent presented to users, but no explicit default_agent config was set
- **Why this works:** Leverages existing list() infrastructure; minimal configuration required. Sort order is already computed, no extra field parsing needed. Falls back to first non-hidden agent
- **Trade-offs:** Less explicit (implicit contract: sort order = default); more efficient (reuses existing sort); fragile (changing sort order unintentionally changes default)

#### [Pattern] System prompt routing through system.ts acts as centralized configuration hub—all model/prompt pairs resolve through one file (2026-02-28)
- **Problem solved:** Ava prompt needed to be used by Claude models (not other models), requiring conditional routing from system.ts
- **Why this works:** Single mutation point prevents prompt duplication and version skew. All model configurations co-locate. Easy to audit which model uses which prompt
- **Trade-offs:** Adding new prompts requires system.ts modification (less modular); audit trail is simple (more maintainable)

#### [Gotcha] Permission denial pattern (edit/write/apply_patch) requires manual enumeration per agent—no bulk 'readonly' mode or role-based defaults (2026-02-28)
- **Situation:** Ava required multiple tool denials; risk of forgetting one tool when copy-pasting agent definition
- **Root cause:** Current implementation uses explicit per-tool denials via PermissionNext.fromConfig(). No abstraction for 'readonly' or 'observer' agent roles
- **How to avoid:** Explicit is safer for code review (clear what's denied); manual enumeration is error-prone (easy to forget a denial); no way to audit completeness

### Plan agent removed entirely and responsibilities absorbed into Ava—capability consolidation rather than microservice decomposition (2026-02-28)
- **Context:** Feature required both planning and building capabilities; could have kept separate plan + build agents or merged into one
- **Why:** Consolidation reduces agent orchestration complexity and context switching. Single agent ('ava') handles planning+building reduces decision latency. Users interact with one agent for that problem domain
- **Rejected:** Keep plan and build separate with hand-off protocol—requires orchestration logic, state passing between agents, potential deadlock on disagreements
- **Trade-offs:** Easier user experience (one agent); agent becomes responsible for more tasks (larger, harder to test); risk: if planning fails, no separate agent to recover
- **Breaking if changed:** Any code or workflows referencing 'plan' agent by name will fail; if plan requires isolation from building in future, re-splitting will be hard without history

#### [Pattern] onMount() serves as implicit 'refresh on focus' trigger in route-based SPA because component re-instantiates each navigation (2026-02-28)
- **Problem solved:** Board panel needs to refresh when home route is navigated to (focus), without explicit route lifecycle hooks
- **Why this works:** In this framework, component mounts happen on route changes. Leveraging re-mount for refresh avoids needing separate focus/visibility APIs
- **Trade-offs:** Simpler (single refresh call in onMount) but couples refresh to mount lifecycle - can't distinguish first load from navigation

### 30-second refresh interval plus mount-time refresh creates dual-trigger pattern: immediate (on navigation) + periodic (background) (2026-02-28)
- **Context:** Board needs to show fresh data when user returns to home, but also stay fresh if user stays on home
- **Why:** onMount catches direct navigation focus; interval catches lingering users; together they cover both UX needs
- **Rejected:** Mount-only refresh (stale after 30s if user stays); interval-only refresh (not updated on navigate)
- **Trade-offs:** Two refresh paths = slightly more code and polling overhead, but ensures data freshness in both scenarios
- **Breaking if changed:** If setInterval is removed (e.g., to save resources), data becomes stale after user stays on home > 1 minute

#### [Gotcha] home.tsx was modified by concurrent feature agent (board status panel, createSignal added) when attempting to edit for welcome message. Required re-reading file before making changes to avoid overwriting concurrent modifications. (2026-02-28)
- **Situation:** Multiple agents working on same codebase with no coordination mechanism for file access
- **Root cause:** Defensive re-reading prevents losing changes from other agents and maintains code integrity during concurrent development
- **How to avoid:** Gained data safety and consistency, cost is additional file I/O and longer implementation time

#### [Pattern] Graceful optional builtin config file loaded via loadFile() that returns {} on ENOENT, allowing compiled binaries to function without source files present (2026-02-28)
- **Problem solved:** ava.jsonc path won't exist in compiled Bun binary since import.meta.dirname points to executable directory, not source tree
- **Why this works:** Enables distributed binaries to work without requiring builtin config file presence while providing dev-time defaults; config.ts already has graceful ENOENT handling
- **Trade-offs:** Silent failure if path is wrong becomes harder to debug; cleaner deployment without extra files

### MCP server configured as 'type': 'remote' at http://localhost:3008/mcp instead of subprocess-managed approach (2026-02-28)
- **Context:** Automaker MCP integrated as external service; must already be running for CLI to use it
- **Why:** Separates concern of MCP lifecycle management from CLI; Automaker is development environment tool with independent deployment
- **Rejected:** Spawn subprocess (requires process management, version pinning, environment setup complexity) or embedded MCP (tight coupling)
- **Trade-offs:** Simpler CLI code vs hard runtime dependency on external service being available; clearer error behavior when service is down
- **Breaking if changed:** If MCP moves to different URL or hostname, constant in board.ts and ava.jsonc both need updates; no automatic service discovery

#### [Pattern] Config layering with ava.jsonc loaded as 'lowest-priority base config' allowing user configs to override defaults (2026-02-28)
- **Problem solved:** Default MCP server config needs to be available but users should be able to customize or replace it
- **Why this works:** Standard config precedence pattern (builtin < user) enables both sensible defaults and customization; prevents lock-in to hardcoded values
- **Trade-offs:** Requires documented config loading order; adds mental model complexity vs single config source

#### [Gotcha] ToolPart Switch statement Match conditions are evaluated in order. MCP tool check must come BEFORE GenericTool fallback, not after. (2026-02-28)
- **Situation:** Adding McpTool component to handle mcp__[server]__[tool_name] format requires specific placement in conditional logic.
- **Root cause:** First matching condition wins in Switch statements. If GenericTool matches all strings (implicit catch-all), MCP tools never reach McpTool handler.
- **How to avoid:** None if placed correctly. Mistakes silently fail — tools appear generic instead of compact.

### Separate binary name ('ava') from package name ('protocli') by using binary name in user-facing paths and infrastructure (2026-02-28)
- **Context:** Package.json name is 'protocli' but CLI binary is 'ava', applied throughout: build output, install paths (~/.ava/bin), user-agent headers
- **Why:** Allows CLI tool name to evolve independently from workspace package name. Package name is infrastructure/release artifact identifier, binary name is user-facing tool identity. Decouples naming for flexibility in multi-tool distribution
- **Rejected:** Single unified name throughout (would make CLI rename require package rename). Install to ~/.protocli (would confuse package vs tool naming)
- **Trade-offs:** Requires careful coordination across build.ts, install scripts, and metadata. More flexible but adds naming conceptual overhead. Build archive uses package name (protocli-*.tar.gz) but extracts binary name (ava) - users see protocli releases but run 'ava' command
- **Breaking if changed:** Changing binary back to 'opencode' breaks: build.ts outfile, install script binary extraction path, user-agent identification, PATH setup. Users who ran 'ava' command would lose it

#### [Pattern] Use install/<binary-name> directory structure instead of flat install files to support multiple installers from one repo (2026-02-28)
- **Problem solved:** Restructured install file to install/ava directory, preserving old install logic as install/opencode
- **Why this works:** Enables multiple distribution channels for different tools (ava, opencode) in the same monorepo. Each tool can have its own installer with custom logic, flags, and installation paths. Scales to adding more tools without cluttering root
- **Trade-offs:** Requires convention documentation (install/<name> pattern not self-obvious). Git tracks both install/ava and install/opencode as separate files, both must be maintained. Clearer discoverability vs more files to manage

#### [Gotcha] Install script hardcodes GitHub release repo (anomalyco/protocli) - release channel becomes part of binary installation logic (2026-02-28)
- **Situation:** install/ava script has hardcoded APP=protocli repo reference for downloading releases
- **Root cause:** Simplest approach - binary knows where to get updates. But creates tight coupling between installation and release infrastructure
- **How to avoid:** Simple installation vs release location locked into binary. Can't easily redirect releases or use different channels without rebuilding