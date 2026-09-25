#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="gnome-oracle"
INSTALL_PATH="${INSTALL_PATH:-/opt/gnome-oracle}"
SERVICE_USER="${SERVICE_USER:-gnome-oracle}"
PORT="${PORT:-8080}"
SERVER_NAME="${SERVER_NAME:-$(hostname -f 2>/dev/null || hostname)}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:4b-instruct}"
OLLAMA_NUM_CTX="${OLLAMA_NUM_CTX:-4096}"
SKIP_OLLAMA_TUNING="${SKIP_OLLAMA_TUNING:-0}"
SKIP_SEARXNG="${SKIP_SEARXNG:-0}"
SEARXNG_PORT="${SEARXNG_PORT:-8888}"
SEARXNG_IMAGE="${SEARXNG_IMAGE:-searxng/searxng:latest}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
NODE_MAJOR_TARGET="${NODE_MAJOR_TARGET:-22}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_OLLAMA_INSTALL="${SKIP_OLLAMA_INSTALL:-0}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
node_bin=""

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run this script with sudo or as root."
  fi
}

ensure_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    die "This installer currently targets Debian/Ubuntu systems with apt-get."
  fi
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

ensure_base_packages() {
  log "Installing base packages..."
  log "Python is only needed at build time for native Node modules like better-sqlite3."
  apt-get update
  apt_install ca-certificates curl gnupg rsync build-essential python3 make g++ nginx
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi

  node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0
}

ensure_node() {
  local current_major
  current_major="$(node_major)"

  if [[ "$current_major" -ge 20 ]]; then
    node_bin="$(command -v node)"
    log "Found Node.js $current_major at $node_bin"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR_TARGET}.x from NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_TARGET}.x" | bash -
  apt-get update
  apt_install nodejs
  node_bin="$(command -v node)"
}

ensure_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama is already installed."
  elif [[ "$SKIP_OLLAMA_INSTALL" == "1" ]]; then
    die "Ollama is not installed. Re-run without SKIP_OLLAMA_INSTALL=1 or install it manually."
  else
    log "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  if systemctl list-unit-files | grep -q '^ollama\.service'; then
    systemctl enable --now ollama >/dev/null 2>&1 || true
  fi
}

wait_for_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    return
  fi

  log "Waiting for Ollama to become ready..."
  for _ in $(seq 1 30); do
    if curl -fsS "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done

  die "Ollama did not become ready at ${OLLAMA_URL}."
}

build_app() {
  if [[ "$SKIP_BUILD" == "1" ]]; then
    log "Skipping build because SKIP_BUILD=1"
    return
  fi

  log "Installing npm dependencies and building the app..."
  pushd "$repo_root" >/dev/null
  npm ci
  npm run build
  popd >/dev/null
}

ensure_standalone_build() {
  local standalone="$repo_root/.next/standalone"
  if [[ ! -f "$standalone/server.js" ]]; then
    die "Standalone build not found at $standalone/server.js. Run without SKIP_BUILD=1."
  fi
}

ensure_service_user() {
  if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    log "Creating service user $SERVICE_USER..."
    useradd --system --home-dir "$INSTALL_PATH" --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  fi
}

deploy_payload() {
  local standalone="$repo_root/.next/standalone"
  local static_src="$repo_root/.next/static"
  local public_src="$repo_root/public"

  log "Deploying app files to $INSTALL_PATH..."
  mkdir -p "$INSTALL_PATH"

  rsync -a --delete \
    --exclude 'data/' \
    --exclude 'logs/' \
    "$standalone"/ \
    "$INSTALL_PATH"/

  mkdir -p "$INSTALL_PATH/.next/static"
  rsync -a --delete "$static_src"/ "$INSTALL_PATH/.next/static"/

  if [[ -d "$public_src" ]]; then
    mkdir -p "$INSTALL_PATH/public"
    rsync -a --delete "$public_src"/ "$INSTALL_PATH/public"/
  fi

  mkdir -p "$INSTALL_PATH/data"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_PATH"
}

write_systemd_service() {
  local service_path="/etc/systemd/system/${SERVICE_NAME}.service"

  log "Writing systemd service..."
  cat >"$service_path" <<EOF
[Unit]
Description=Gnome Oracle Next.js app
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_PATH}
Environment=PORT=${PORT}
Environment=HOSTNAME=127.0.0.1
Environment=NODE_ENV=production
Environment=OLLAMA_MODEL=${OLLAMA_MODEL}
Environment=OLLAMA_NUM_CTX=${OLLAMA_NUM_CTX}
Environment=OLLAMA_URL=${OLLAMA_URL}
Environment=SEARXNG_CONTROL=$([[ "$SKIP_SEARXNG" == "1" ]] && echo none || echo systemd)
Environment=SEARXNG_URL=http://127.0.0.1:${SEARXNG_PORT}
ExecStart=${node_bin} server.js
Restart=always
RestartSec=10
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
}

write_nginx_config() {
  local nginx_config=""
  local nginx_link=""

  if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
    nginx_config="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
    nginx_link="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
  else
    nginx_config="/etc/nginx/conf.d/${SERVICE_NAME}.conf"
  fi

  log "Writing nginx config for server name: $SERVER_NAME"
  cat >"$nginx_config" <<EOF
server {
  listen 80;
  server_name ${SERVER_NAME};

  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  if [[ -n "$nginx_link" ]]; then
    ln -sf "$nginx_config" "$nginx_link"
  fi

  nginx -t
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl reload nginx
}

# Small-RAM tuning for the Ollama service. Each parallel slot multiplies
# KV-cache memory, and a q8_0 KV cache roughly halves it again.
tune_ollama() {
  if [[ "$SKIP_OLLAMA_TUNING" == "1" ]] || ! systemctl list-unit-files ollama.service >/dev/null 2>&1; then
    log "Skipping Ollama tuning."
    return
  fi

  local dropin_dir="/etc/systemd/system/ollama.service.d"
  mkdir -p "$dropin_dir"
  cat >"$dropin_dir/gnome-oracle.conf" <<EOF
[Service]
Environment=OLLAMA_NUM_PARALLEL=1
Environment=OLLAMA_MAX_LOADED_MODELS=1
Environment=OLLAMA_FLASH_ATTENTION=1
Environment=OLLAMA_KV_CACHE_TYPE=q8_0
Environment=OLLAMA_KEEP_ALIVE=30m
EOF
  systemctl daemon-reload
  systemctl restart ollama
  wait_for_ollama

  local ram_kb
  ram_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  if (( ram_kb > 0 && ram_kb < 8000000 )); then
    log "Note: this server has $(( ram_kb / 1024 )) MB RAM. Keep the context at 4096 or less,"
    log "      and consider a 2-4 GB swap file so a model load cannot exhaust memory."
    if ! swapon --show 2>/dev/null | grep -q .; then
      log "      No swap is active. Example: fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
    fi
  fi
}

# Web search: SearXNG in Docker behind an on-demand systemd unit; see setup-searxng.sh.
setup_searxng() {
  if [[ "$SKIP_SEARXNG" == "1" ]]; then
    log "Skipping SearXNG web search."
    return
  fi
  SERVICE_USER="$SERVICE_USER" APP_UNIT="${SERVICE_NAME}.service" SEARXNG_PORT="$SEARXNG_PORT" SEARXNG_IMAGE="$SEARXNG_IMAGE"     bash "$script_dir/setup-searxng.sh"
}

pull_model() {
  if ! command -v ollama >/dev/null 2>&1; then
    log "Skipping model pull because ollama is unavailable."
    return
  fi

  log "Pulling Ollama model: $OLLAMA_MODEL"
  ollama pull "$OLLAMA_MODEL"
}

main() {
  require_root
  ensure_apt
  ensure_base_packages
  ensure_node
  ensure_ollama
  wait_for_ollama
  build_app
  ensure_standalone_build
  ensure_service_user
  deploy_payload
  write_systemd_service
  write_nginx_config
  tune_ollama
  setup_searxng
  pull_model

  log ""
  log "Gnome Oracle is installed."
  log "App directory: $INSTALL_PATH"
  log "Public URL:    http://$SERVER_NAME"
  log "Local port:    http://127.0.0.1:$PORT"
  log "Model:         $OLLAMA_MODEL via $OLLAMA_URL"
  log ""
  log "If you want HTTPS, add a certificate after nginx is working."
}

main "$@"
