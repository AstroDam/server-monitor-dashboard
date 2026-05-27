#!/bin/bash

set -e

if [ -z "$AGENT_TOKEN" ]; then
  echo "ERRO: informe AGENT_TOKEN"
  exit 1
fi

API_BASE="${API_BASE:-http://167.234.246.158:3000/metrics}"
INSTALL_DIR="/opt/monitor-agent"

echo "Instalando Monitor Agent..."

apt update -y
apt install -y curl ca-certificates nodejs npm

mkdir -p "$INSTALL_DIR"

curl -fsSL https://raw.githubusercontent.com/AstroDam/server-monitor-dashboard/main/agent/agent.js \
  -o "$INSTALL_DIR/agent.js"

curl -fsSL https://raw.githubusercontent.com/AstroDam/server-monitor-dashboard/main/agent/package.json \
  -o "$INSTALL_DIR/package.json"

cd "$INSTALL_DIR"
npm install --omit=dev

cat > /etc/systemd/system/monitor-agent.service <<EOF
[Unit]
Description=Monitor Dashboard Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=AGENT_TOKEN=$AGENT_TOKEN
Environment=API_BASE=$API_BASE
Environment=AGENT_INTERVAL_MS=5000
ExecStart=/usr/bin/node $INSTALL_DIR/agent.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable monitor-agent
systemctl restart monitor-agent

echo "Monitor Agent instalado com sucesso."
echo "Status:"
systemctl status monitor-agent --no-pager