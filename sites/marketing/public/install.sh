#!/bin/sh
# proto installer — https://cli.protolabs.studio/install.sh
#
#   curl -fsSL https://cli.protolabs.studio/install.sh | sh
#
# Ensures Node >= 20 (installs it via fnm if missing), installs the proto CLI
# globally from npm, then launches the setup wizard.
set -eu

PKG="@protolabsai/proto"
MIN_NODE=20

esc() { printf '\033[%sm' "$1"; }
info() { printf '%s›%s %s\n' "$(esc '1;35')" "$(esc 0)" "$1"; }
ok()   { printf '%s✓%s %s\n' "$(esc '1;32')" "$(esc 0)" "$1"; }
warn() { printf '%s!%s %s\n' "$(esc '1;33')" "$(esc 0)" "$1" >&2; }
die()  { printf '%s✗%s %s\n' "$(esc '1;31')" "$(esc 0)" "$1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

node_major() {
  m=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
  case "$m" in '' | *[!0-9]*) echo 0 ;; *) echo "$m" ;; esac
}

ensure_node() {
  if have node && [ "$(node_major)" -ge "$MIN_NODE" ]; then
    ok "Node $(node -v) detected"
    return
  fi
  if have node; then
    warn "Node $(node -v) is older than the required v$MIN_NODE."
  else
    warn "Node not found."
  fi
  have curl || die "Need Node v$MIN_NODE+ and curl. Install Node from https://nodejs.org/ and re-run."

  info "Installing Node v$MIN_NODE via fnm…"
  curl -fsSL https://fnm.vercel.app/install | bash >/dev/null 2>&1 \
    || die "Couldn't install fnm. Install Node v$MIN_NODE+ from https://nodejs.org/ and re-run."

  # Load fnm into this shell session so npm is available below.
  for d in "$HOME/.local/share/fnm" "$HOME/.fnm"; do
    [ -d "$d" ] && PATH="$d:$PATH" && export PATH
  done
  have fnm || die "fnm installed but not on PATH. Open a new terminal and re-run."
  eval "$(fnm env)" 2>/dev/null || true
  fnm install "$MIN_NODE" >/dev/null 2>&1
  fnm use "$MIN_NODE" >/dev/null 2>&1
  fnm default "$MIN_NODE" >/dev/null 2>&1 || true
  ok "Node $(node -v) installed"
}

install_proto() {
  info "Installing $PKG…"
  if npm install -g "$PKG" >/dev/null 2>&1; then
    return
  fi
  # Global install failed — almost always a permissions issue. Retry into a
  # user-owned prefix so we never need sudo.
  warn "Global install needs elevated permissions; using a user prefix instead."
  prefix="$HOME/.proto/npm"
  mkdir -p "$prefix"
  npm install -g --prefix "$prefix" "$PKG" >/dev/null 2>&1 \
    || die "npm install failed. Try: npm install -g $PKG"
  PATH="$prefix/bin:$PATH"
  export PATH
  case ":$PATH:" in
    *":$prefix/bin:"*)
      warn "Add this to your shell profile so 'proto' stays on PATH:"
      printf '    export PATH="%s/bin:$PATH"\n' "$prefix" >&2
      ;;
  esac
}

main() {
  printf '\n'
  info "Installing proto — a local, privacy-first AI agent for the terminal"
  ensure_node
  install_proto

  have proto || die "Installed, but 'proto' isn't on PATH yet. Open a new terminal and run: proto setup"
  ok "proto $(proto --version 2>/dev/null || echo 'installed')"

  # Launch the setup wizard. Under \`curl | sh\` our stdin is the script, so read
  # the wizard's input from the terminal directly when one is attached.
  if [ -t 1 ] && [ -r /dev/tty ]; then
    printf '\n'
    info "Launching the setup wizard…"
    proto setup </dev/tty || warn "Setup didn't finish — run it any time with: proto setup"
  else
    printf '\n'
    ok "Installed. Next: run  proto setup  to configure a model, then  proto"
  fi
}

main
