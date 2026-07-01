#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

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

# Deploy full postfix configuration
sudo cp "$CONFIG_SRC" "$CONFIG_DST"
sudo postfix check
sudo systemctl restart postfix
echo "Postfix installed and configured"
