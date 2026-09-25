#!/usr/bin/env bash
# Set up SearXNG web search for Gnome Oracle on a Debian/Ubuntu server.
#
# Runs SearXNG in Docker behind a systemd unit that is NOT started at boot:
# the app starts/stops it from Settings. A polkit rule lets the app's user
# manage only that one unit, so the app never needs Docker or root.
#
# Safe to re-run. install-linux.sh calls this; on a server deployed another
# way, run it on its own:  sudo bash deploy/setup-searxng.sh

set -euo pipefail

SERVICE_USER="${SERVICE_USER:-gnome-oracle}"
APP_UNIT="${APP_UNIT:-gnome-oracle.service}"
SEARXNG_PORT="${SEARXNG_PORT:-8888}"
SEARXNG_IMAGE="${SEARXNG_IMAGE:-searxng/searxng:latest}"
CONFIG_DIR="/etc/gnome-searxng"

log() { printf 'setup-searxng: %s\n' "$*"; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }
id "$SERVICE_USER" >/dev/null 2>&1 || { echo "User $SERVICE_USER does not exist; set SERVICE_USER." >&2; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io
fi
systemctl enable --now docker >/dev/null 2>&1 || true
if ! dpkg -s polkitd >/dev/null 2>&1 && ! dpkg -s policykit-1 >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y polkitd || DEBIAN_FRONTEND=noninteractive apt-get install -y policykit-1
fi

mkdir -p "$CONFIG_DIR"
if [[ ! -f "$CONFIG_DIR/settings.yml" ]]; then
  log "writing $CONFIG_DIR/settings.yml"
  cat >"$CONFIG_DIR/settings.yml" <<EOF
use_default_settings: true
server:
  secret_key: "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  limiter: false
  image_proxy: false
  public_instance: false
search:
  safe_search: 1
  formats:
    - html
    - json
EOF
  chmod 644 "$CONFIG_DIR/settings.yml"
fi

log "downloading the SearXNG image (used only while web search is on)..."
docker pull "$SEARXNG_IMAGE"

docker_bin="$(command -v docker)"
cat >/etc/systemd/system/gnome-searxng.service <<EOF
[Unit]
Description=SearXNG web search for Gnome Oracle (started and stopped from the app)
After=docker.service
Requires=docker.service

[Service]
ExecStartPre=-${docker_bin} rm -f gnome-searxng
ExecStart=${docker_bin} run --rm --name gnome-searxng -p 127.0.0.1:${SEARXNG_PORT}:8080 -v ${CONFIG_DIR}:/etc/searxng -e SEARXNG_BASE_URL=http://127.0.0.1:${SEARXNG_PORT}/ ${SEARXNG_IMAGE}
ExecStop=${docker_bin} stop -t 5 gnome-searxng
Restart=on-failure
EOF

mkdir -p /etc/polkit-1/rules.d
cat >/etc/polkit-1/rules.d/50-gnome-searxng.rules <<EOF
// Let Gnome Oracle start and stop its SearXNG unit, and nothing else.
polkit.addRule(function (action, subject) {
  if (action.id == "org.freedesktop.systemd1.manage-units" &&
      action.lookup("unit") == "gnome-searxng.service" &&
      subject.user == "${SERVICE_USER}") {
    var verb = action.lookup("verb");
    if (verb == "start" || verb == "stop" || verb == "restart") return polkit.Result.YES;
  }
});
EOF

# Tell the app how to reach SearXNG (a drop-in, so it survives other deploy tooling).
mkdir -p "/etc/systemd/system/${APP_UNIT}.d"
cat >"/etc/systemd/system/${APP_UNIT}.d/20-searxng.conf" <<EOF
[Service]
Environment=SEARXNG_CONTROL=systemd
Environment=SEARXNG_URL=http://127.0.0.1:${SEARXNG_PORT}
EOF

systemctl daemon-reload
systemctl restart polkit >/dev/null 2>&1 || true
log "done. Restart the app (systemctl restart ${APP_UNIT}), then switch web search on in Settings."
