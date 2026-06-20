import { defineConfig } from "vitepress";

// Two deploys coexist:
//  - GitHub Pages (docs-deploy.yml) serves at /protoCLI/ (the fallback).
//  - The Cloudflare marketing build folds these docs in at /docs/ via DOCS_BASE.
// DOCS_BASE wins, then legacy BASE_PATH, then the GitHub Pages default.
const base = process.env.DOCS_BASE ?? process.env.BASE_PATH ?? "/protoCLI/";

export default defineConfig({
  base,
  lang: "en-US",
  title: "proto",
  description:
    "A local, privacy-first AI agent for the terminal — read, write, and run code against the models you choose.",

  head: [
    // Favicon — served from docs/public/ at the configured base (works under
    // both the /protoCLI/ GitHub Pages base and the /docs/ Cloudflare fold).
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }],
  ],

  // Docs are dark-first, like the marketing site. The brand accent flows live
  // from the @protolabsai/design tokens via @protolabsai/vitepress-theme.
  appearance: "force-dark",
  cleanUrls: true,
  lastUpdated: true,

  // Tutorials reference the local dev server / localhost endpoints; VitePress
  // treats dead links as fatal, so skip just the localhost ones.
  ignoreDeadLinks: "localhostLinks",

  themeConfig: {
    nav: [
      { text: "Tutorials", link: "/tutorials/getting-started" },
      { text: "Guides", link: "/guides/", activeMatch: "/guides/" },
      { text: "Reference", link: "/reference/", activeMatch: "/reference/" },
      {
        text: "Explanation",
        link: "/explanation/",
        activeMatch: "/explanation/",
      },
      {
        text: "Contributing",
        link: "/contributing/",
        activeMatch: "/contributing/",
      },
    ],

    // Diátaxis sections live in the nav. Within each section the sidebar is
    // grouped by ONE shared domain taxonomy — the same domain names recur
    // across Tutorials / Guides / Reference / Explanation, and a section only
    // lists the domains it actually has pages for. So "where does X live?"
    // reads the same everywhere. Canonical domain order:
    //   Getting started → Models, providers & auth → Agentic features & harness
    //   → Tools, MCP & LSP → Context & memory → Permissions & safety
    //   → Running & automation → Editors & protocols → Interface & customization
    //   → Configuration & maintenance
    sidebar: {
      "/tutorials/": [
        {
          text: "Getting started",
          collapsed: false,
          items: [{ text: "Getting Started", link: "/tutorials/getting-started" }],
        },
        {
          text: "Agentic features & harness",
          collapsed: false,
          items: [
            { text: "Build Your First Sub-Agent", link: "/tutorials/first-agent" },
            { text: "Create Your First Skill", link: "/tutorials/first-skill" },
          ],
        },
      ],

      "/guides/": [
        { text: "Guides", items: [{ text: "Overview", link: "/guides/" }] },
        {
          text: "Getting started",
          collapsed: false,
          items: [{ text: "Run the Setup Wizard", link: "/guides/setup-wizard" }],
        },
        {
          text: "Models, providers & auth",
          collapsed: false,
          items: [
            { text: "Configure Models & Auth", link: "/guides/configure-models" },
            { text: "Token Caching", link: "/guides/token-caching" },
          ],
        },
        {
          text: "Agentic features & harness",
          collapsed: false,
          items: [
            { text: "Use Sub-Agents", link: "/guides/use-sub-agents" },
            { text: "Use Agent Teams", link: "/guides/use-teams" },
            { text: "Use Skills", link: "/guides/use-skills" },
            { text: "Use Hooks", link: "/guides/use-hooks" },
            { text: "Work Toward a Goal", link: "/guides/goal" },
          ],
        },
        {
          text: "Tools, MCP & LSP",
          collapsed: false,
          items: [
            { text: "Connect via MCP", link: "/guides/use-mcp" },
            { text: "Language Server Protocol", link: "/guides/use-lsp" },
          ],
        },
        {
          text: "Context & memory",
          collapsed: false,
          items: [
            { text: "Manage Memory", link: "/guides/manage-memory" },
            { text: "Ignore Files", link: "/guides/ignoring-files" },
            { text: "Export Sessions", link: "/guides/session-export" },
          ],
        },
        {
          text: "Permissions & safety",
          collapsed: false,
          items: [
            { text: "Approval Mode", link: "/guides/approval-mode" },
            { text: "Sandboxing", link: "/guides/use-sandbox" },
            { text: "Trusted Folders", link: "/guides/trusted-folders" },
          ],
        },
        {
          text: "Running & automation",
          collapsed: false,
          items: [
            { text: "Run Headless (Non-Interactive)", link: "/guides/run-headless" },
            { text: "Schedule Prompts", link: "/guides/scheduled-tasks" },
            { text: "GitHub Actions", link: "/guides/ci-github-actions" },
          ],
        },
        {
          text: "Editors & protocols",
          collapsed: false,
          items: [
            { text: "ACP Coding Agent", link: "/guides/acp-coding-agent" },
            { text: "A2A Agents", link: "/guides/a2a-agents" },
            { text: "Zed", link: "/guides/ide-zed" },
          ],
        },
        {
          text: "Interface & customization",
          collapsed: false,
          items: [
            { text: "Themes", link: "/guides/themes" },
            { text: "Voice Input (Push-to-Talk)", link: "/guides/voice-input" },
          ],
        },
      ],

      "/reference/": [
        { text: "Reference", items: [{ text: "Overview", link: "/reference/" }] },
        {
          text: "Configuration & maintenance",
          collapsed: false,
          items: [
            { text: "Settings", link: "/reference/settings" },
            { text: "Troubleshooting", link: "/reference/troubleshooting" },
            { text: "Uninstall", link: "/reference/uninstall" },
          ],
        },
        {
          text: "Models, providers & auth",
          collapsed: false,
          items: [
            { text: "Model Providers", link: "/reference/model-providers" },
            { text: "Authentication", link: "/reference/auth" },
          ],
        },
        {
          text: "Tools, MCP & LSP",
          collapsed: false,
          items: [
            { text: "SDK API", link: "/reference/sdk-api" },
            {
              text: "Tools reference",
              link: "/reference/tools/introduction",
              collapsed: false,
              items: [
                { text: "Overview", link: "/reference/tools/introduction" },
                { text: "File System", link: "/reference/tools/file-system" },
                { text: "Multi-File Read", link: "/reference/tools/multi-file" },
                { text: "Shell", link: "/reference/tools/shell" },
                { text: "Stop Background Shell", link: "/reference/tools/bg-stop" },
                { text: "Task", link: "/reference/tools/task" },
                { text: "Exit Plan Mode", link: "/reference/tools/exit-plan-mode" },
                { text: "Web Fetch", link: "/reference/tools/web-fetch" },
                { text: "Web Search", link: "/reference/tools/web-search" },
                { text: "Memory", link: "/reference/tools/memory" },
                { text: "Browser", link: "/reference/tools/browser" },
                { text: "MCP Servers", link: "/reference/tools/mcp-server" },
                { text: "Sandboxing", link: "/reference/tools/sandbox" },
              ],
            },
          ],
        },
        {
          text: "Context & memory",
          collapsed: false,
          items: [
            { text: "Memory", link: "/reference/memory" },
            { text: "Beads Task Tracker", link: "/reference/beads" },
          ],
        },
        {
          text: "Interface & customization",
          collapsed: false,
          items: [
            { text: "Commands", link: "/reference/commands" },
            { text: "Keyboard Shortcuts", link: "/reference/keyboard-shortcuts" },
          ],
        },
      ],

      "/explanation/": [
        { text: "Explanation", items: [{ text: "Overview", link: "/explanation/" }] },
        {
          text: "Agentic features & harness",
          collapsed: false,
          items: [
            { text: "Architecture", link: "/explanation/architecture" },
            { text: "Agent Harness", link: "/explanation/agent-harness" },
            { text: "Sub-Agents", link: "/explanation/sub-agents-design" },
            { text: "Background Agents", link: "/explanation/background-agents-design" },
            { text: "Skills", link: "/explanation/skills-design" },
            { text: "Hooks", link: "/explanation/hooks-design" },
          ],
        },
        {
          text: "Permissions & safety",
          collapsed: false,
          items: [{ text: "Approval Modes", link: "/explanation/approval-modes" }],
        },
      ],

      "/contributing/": [
        {
          text: "Contributing",
          items: [
            { text: "Overview", link: "/contributing/" },
            { text: "Contributing Guide", link: "/contributing/overview" },
            { text: "Development Workflow", link: "/contributing/development" },
            { text: "TypeScript SDK", link: "/contributing/sdk-typescript" },
            { text: "Telemetry & Observability", link: "/contributing/telemetry" },
            { text: "Roadmap", link: "/contributing/roadmap" },
            {
              text: "Examples",
              link: "/contributing/examples/",
              collapsed: false,
              items: [
                { text: "SDK Sub-Agent Examples", link: "/contributing/examples/sdk-agents" },
                { text: "SDK Hook Examples", link: "/contributing/examples/sdk-hooks" },
                { text: "SDK Tool Examples", link: "/contributing/examples/sdk-tools" },
                { text: "Proxy Script Example", link: "/contributing/examples/proxy-script" },
              ],
            },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/protoLabsAI/protoCLI" },
    ],

    search: { provider: "local" },

    editLink: {
      pattern: "https://github.com/protoLabsAI/protoCLI/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "© protoLabs.studio",
    },
  },
});
