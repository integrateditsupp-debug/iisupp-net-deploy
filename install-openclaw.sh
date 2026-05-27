#!/usr/bin/env bash
# install-openclaw.sh — corrected OpenClaw self-host installer.
#
#   curl -fsSL https://iisupp.net/install-openclaw.sh | sudo -E bash
#   OR (after pulling):  sudo -E bash install-openclaw.sh
#
# WHY THIS WAS REWRITTEN (2026-05-27):
#   The previous version assumed OpenClaw was a Docker Compose stack and proxied
#   Caddy to port 8080. Both were wrong. OpenClaw (steipete, github.com/openclaw/
#   openclaw) is an **npm CLI** that runs a Gateway daemon on **port 18789**.
#   The old script cloned the repo, found no docker-compose.yml, exited with
#   "no docker-compose.yml found", and the daemon never started — so the mesh
#   router's calls to https://openclaw.iisupp.net/... always failed and no agents
#   were ever spawned. This version installs it the supported way.
#
# What it does:
#   1. Installs Node.js LTS (+ npm) if missing — OpenClaw's only hard dependency
#   2. Installs the OpenClaw CLI globally:  npm i -g openclaw@latest
#   3. Brings up the Gateway daemon:        openclaw onboard --install-daemon
#   4. Installs/points Caddy at the CORRECT port (18789) for openclaw.iisupp.net
#   5. Health-checks http://127.0.0.1:18789/ and prints next steps
#
# Env vars (export before running, or accept defaults):
#   ANTHROPIC_API_KEY       — your Anthropic key (OpenClaw reads it during onboard)
#   PUBLIC_DOMAIN           — default openclaw.iisupp.net (CNAME -> droplet first)
#   OPENCLAW_PORT           — default 18789 (only change if you remap the gateway)
#
# NOTE: `openclaw onboard` is a GUIDED setup. On a fresh box it may prompt for
#   model/provider keys and which chat channels to connect (Telegram @IISUPP_bot,
#   WhatsApp, Slack, …). If you need a fully unattended install, pre-seed the
#   OpenClaw config or run `openclaw onboard` once interactively, then this script
#   is safe to re-run idempotently. Channel pairing (e.g. Telegram) is done from
#   the dashboard at http://127.0.0.1:18789/ or `openclaw channels` — NOT via a
#   .env file (that was the old, incorrect assumption).

set -euo pipefail
LOG_FILE=/var/log/openclaw-install.log
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-openclaw.iisupp.net}"

log() { echo "[$(date +%T)] $*" | tee -a "$LOG_FILE"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root or with sudo (use 'sudo -E' to keep your exported env vars)." >&2
    exit 1
  fi
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    log "Node already installed: $(node --version)"
  else
    log "Installing Node.js LTS (NodeSource)…"
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
  fi
  log "npm: $(npm --version)"
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    log "Caddy already installed: $(caddy version | head -1)"
    return
  fi
  log "Installing Caddy…"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
}

install_openclaw() {
  log "Installing OpenClaw CLI globally…"
  npm install -g openclaw@latest
  log "OpenClaw version: $(openclaw --version 2>/dev/null || echo 'installed')"
}

start_gateway() {
  log "Bringing up the OpenClaw Gateway daemon (openclaw onboard --install-daemon)…"
  log "If this step prompts, complete the guided setup once; re-running the script afterward is safe."
  # --install-daemon registers OpenClaw as a managed background service.
  if openclaw onboard --install-daemon; then
    log "Gateway daemon install/onboard completed."
  else
    log "WARN: 'openclaw onboard --install-daemon' returned non-zero — it may need an interactive run."
    log "      Run 'openclaw onboard' manually on this host, then 'openclaw start' (or re-run this script)."
  fi
  # Best-effort start in case the daemon isn't auto-started
  openclaw start >/dev/null 2>&1 || true
}

configure_caddy() {
  log "Configuring Caddy reverse proxy for $PUBLIC_DOMAIN → 127.0.0.1:$OPENCLAW_PORT …"
  mkdir -p /etc/caddy/Caddyfile.d /var/log/caddy
  cat > /etc/caddy/Caddyfile.d/openclaw.conf <<EOF
$PUBLIC_DOMAIN {
    reverse_proxy 127.0.0.1:$OPENCLAW_PORT
    encode gzip
    log {
        output file /var/log/caddy/openclaw-access.log
        format console
    }
}
EOF
  if ! grep -q "import /etc/caddy/Caddyfile.d/" /etc/caddy/Caddyfile 2>/dev/null; then
    echo "import /etc/caddy/Caddyfile.d/*.conf" >> /etc/caddy/Caddyfile
  fi
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  log "Caddy reloaded. HTTPS auto-provisions on first request to https://$PUBLIC_DOMAIN/"
}

health_check() {
  log "Health-checking the gateway on http://127.0.0.1:$OPENCLAW_PORT/ …"
  for i in $(seq 1 15); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$OPENCLAW_PORT/" 2>/dev/null; then
      log "OK — gateway responding on port $OPENCLAW_PORT."
      return 0
    fi
    sleep 2
  done
  log "WARN: gateway not responding on port $OPENCLAW_PORT yet."
  log "      Check with: openclaw status   |   journalctl -u openclaw -e   |   openclaw logs"
  return 1
}

print_summary() {
  echo ""
  echo "============================================"
  echo " OpenClaw install finished"
  echo "============================================"
  echo " Local dashboard : http://127.0.0.1:$OPENCLAW_PORT/   (SSH-tunnel to reach it)"
  echo " Public URL      : https://$PUBLIC_DOMAIN/"
  echo " Status / logs   : openclaw status   |   openclaw logs   |   journalctl -u openclaw -e"
  echo ""
  echo " NEXT:"
  echo "   1. If onboard didn't finish, run interactively:  openclaw onboard"
  echo "   2. Connect Telegram (@IISUPP_bot) from the dashboard or 'openclaw channels'."
  echo "   3. Confirm the mesh registry endpoint matches OpenClaw's real task API:"
  echo "      registry has https://$PUBLIC_DOMAIN/api/v1/task — verify that path"
  echo "      exists in OpenClaw (check 'openclaw' docs / dashboard API). If OpenClaw"
  echo "      has no REST task endpoint, drive it via a channel (Telegram) instead and"
  echo "      update aria-mesh-router's openclaw-assistant endpoint accordingly."
  echo "   4. Make sure the droplet firewall allows 80/443 (Caddy) but NOT 18789 publicly."
  echo "============================================"
}

main() {
  require_root
  mkdir -p "$(dirname "$LOG_FILE")"; : > "$LOG_FILE"
  log "Starting OpenClaw install. Log: $LOG_FILE"
  apt-get update -y
  install_node
  install_caddy
  install_openclaw
  start_gateway
  configure_caddy
  health_check || true
  print_summary
}

main "$@"
