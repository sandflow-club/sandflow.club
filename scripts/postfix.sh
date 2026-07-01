#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source configuration
source "$ROOT_DIR/config.env"

CONFIG_SRC="$ROOT_DIR/share/config/postfix/main.cf"
CONFIG_DST="/etc/postfix/main.cf"

if [ ! -f "$CONFIG_SRC" ]; then
    echo "Error: Postfix config not found at $CONFIG_SRC"
    exit 1
fi

# Non-interactive install to avoid config prompts hanging the script
export DEBIAN_FRONTEND=noninteractive
sudo apt update
sudo apt install -y postfix

# Backup existing config if present
if [ -f "$CONFIG_DST" ]; then
    sudo cp "$CONFIG_DST" "$CONFIG_DST.bak.$(date +%Y%m%d_%H%M%S)"
    echo "Backed up existing main.cf"
fi

# Deploy full postfix configuration with variable substitution
sed -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__MAIL_CERT_NAME__/${MAIL_CERT_NAME}/g" \
    "$CONFIG_SRC" | sudo tee "$CONFIG_DST" > /dev/null
sudo postfix check
sudo systemctl restart postfix
echo "Postfix installed and configured"
