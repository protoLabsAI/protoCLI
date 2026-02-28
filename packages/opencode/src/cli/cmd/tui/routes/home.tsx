import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { Logo } from "../component/logo"
import { Tips } from "../component/tips"
import { Locale } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { Installation } from "@/installation"
import { useKV } from "../context/kv"
import { useCommandDialog } from "../component/dialog-command"

// TODO: what is the best way to do this?
let once = false

type BoardFeature = {
  id: string
  title: string
  status: string
  updatedAt?: string
}

type BoardSummary = {
  total: number
  backlog: number
  inProgress: number
  review: number
  blocked: number
  recentFeatures: BoardFeature[]
}

const AUTOMAKER_API = "http://localhost:3008/api/board/summary"
const REFRESH_INTERVAL_MS = 30_000

async function fetchBoardSummary(): Promise<BoardSummary | null> {
  try {
    const res = await fetch(AUTOMAKER_API, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    return (await res.json()) as BoardSummary
  } catch {
    return null
  }
}

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0)
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const showTips = createMemo(() => {
    // Don't show tips for first-time users
    if (isFirstTimeUser()) return false
    return !tipsHidden()
  })

  // Board status
  const [boardData, setBoardData] = createSignal<BoardSummary | null>(null)
  const [boardOnline, setBoardOnline] = createSignal(false)

  async function refreshBoard() {
    const data = await fetchBoardSummary()
    if (data) {
      setBoardData(data)
      setBoardOnline(true)
    } else {
      setBoardOnline(false)
    }
  }

  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips",
      value: "tips.toggle",
      keybind: "tips_toggle",
      category: "System",
      onSelect: (dialog) => {
        kv.set("tips_hidden", !tipsHidden())
        dialog.clear()
      },
    },
  ])

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  onMount(() => {
    if (once) return
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      once = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      once = true
      prompt.submit()
    }
  })

  onMount(() => {
    refreshBoard()
    const interval = setInterval(refreshBoard, REFRESH_INTERVAL_MS)
    onCleanup(() => clearInterval(interval))
  })

  const directory = useDirectory()

  const keybind = useKeybind()

  const featureStatusColor = (status: string) => {
    switch (status) {
      case "in-progress":
        return theme.success
      case "blocked":
        return theme.error
      case "review":
        return theme.warning
      default:
        return theme.textMuted
    }
  }

  return (
    <>
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box flexShrink={0}>
          <Logo />
        </box>
        <box height={1} minHeight={0} flexShrink={1} />
        {/* Board status panel */}
        <box flexShrink={0} width="100%" maxWidth={75} paddingTop={1}>
          <Switch>
            <Match when={!boardOnline()}>
              <text fg={theme.textMuted}>⊙ Automaker offline</text>
            </Match>
            <Match when={boardOnline()}>
              <box gap={1}>
                {/* Summary counts row */}
                <box flexDirection="row" gap={3}>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>total </span>
                    <span style={{ fg: theme.text }}>{boardData()?.total ?? 0}</span>
                  </text>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>backlog </span>
                    <span style={{ fg: theme.text }}>{boardData()?.backlog ?? 0}</span>
                  </text>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>in-progress </span>
                    <span style={{ fg: theme.success }}>{boardData()?.inProgress ?? 0}</span>
                  </text>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>review </span>
                    <span style={{ fg: theme.warning }}>{boardData()?.review ?? 0}</span>
                  </text>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: theme.textMuted }}>blocked </span>
                    <span style={{ fg: theme.error }}>{boardData()?.blocked ?? 0}</span>
                  </text>
                </box>
                {/* Recent features */}
                <Show when={(boardData()?.recentFeatures?.length ?? 0) > 0}>
                  <box>
                    <text fg={theme.textMuted}>Recent</text>
                    <For each={boardData()?.recentFeatures?.slice(0, 5) ?? []}>
                      {(feature) => (
                        <box flexDirection="row" gap={1}>
                          <text flexShrink={0} fg={featureStatusColor(feature.status)}>
                            •
                          </text>
                          <text fg={theme.text} flexShrink={1} wrapMode="word">
                            {feature.title}
                          </text>
                          <text flexShrink={0} fg={theme.textMuted}>
                            {feature.status}
                          </text>
                        </box>
                      )}
                    </For>
                  </box>
                </Show>
              </box>
            </Match>
          </Switch>
        </box>
        <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
          <Prompt
            ref={(r) => {
              prompt = r
              promptRef.set(r)
            }}
            hint={Hint}
          />
        </box>
        <box height={4} minHeight={0} width="100%" maxWidth={75} alignItems="center" paddingTop={3} flexShrink={1}>
          <Show when={isFirstTimeUser()}>
            <text fg={theme.textMuted}>Welcome to ava — your AI coding assistant by protoLabs. Start typing to begin.</text>
          </Show>
          <Show when={showTips()}>
            <Tips />
          </Show>
        </box>
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
            <text fg={theme.text}>
              <Switch>
                <Match when={mcpError()}>
                  <span style={{ fg: theme.error }}>⊙ </span>
                </Match>
                <Match when={true}>
                  <span style={{ fg: connectedMcpCount() > 0 ? theme.success : theme.textMuted }}>⊙ </span>
                </Match>
              </Switch>
              {connectedMcpCount()} MCP
            </text>
            <text fg={theme.textMuted}>/status</text>
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexShrink={0}>
          <text fg={theme.textMuted}>{Installation.VERSION}</text>
        </box>
      </box>
    </>
  )
}
