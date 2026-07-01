#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

CONFIG_SRC="$ROOT_DIR/share/config/opendkim/opendkim.conf"
CONFIG_DST="/etc/opendkim.conf"
KEY_DIR="/etc/opendkim/keys/smtp.sandflow.club"
KEY_FILE="$KEY_DIR/selector1.private"

if [ ! -f "$CONFIG_SRC" ]; then
    echo "Error: OpenDKIM config not found at $CONFIG_SRC"
    exit 1
fi

# Non-interactive install
export DEBIAN_FRONTEND=noninteractive
sudo apt update
sudo apt install -y opendkim opendkim-tools

# Backup existing config if present
if [ -f "$CONFIG_DST" ]; then
    sudo cp "$CONFIG_DST" "$CONFIG_DST.bak.$(date +%Y%m%d_%H%M%S)"
    echo "Backed up existing opendkim.conf"
fi

# Deploy configuration
sudo cp "$CONFIG_SRC" "$CONFIG_DST"
sudo chown opendkim:opendkim "$CONFIG_DST"
sudo chmod 640 "$CONFIG_DST"
echo "OpenDKIM config deployed"

# Check if DKIM key exists — if not, generate one
if [ ! -f "$KEY_FILE" ]; then
    echo ""
    echo "=== No DKIM key found. Generating new key pair... ==="
    sudo mkdir -p "$KEY_DIR"
    sudo opendkim-genkey -D "$KEY_DIR" -d smtp.sandflow.club -s selector1
    sudo chown -R opendkim:opendkim /etc/opendkim/keys

    echo ""
    echo "=== DNS TXT record (add this to your DNS zone) ==="
    cat "$KEY_DIR/selector1.txt"
    echo ""
    echo "Add the above TXT record to your DNS before DKIM signing will work."
else
    echo "DKIM key already exists at $KEY_FILE, skipping key generation"
fi

# Add postfix user to opendkim group for socket access
sudo usermod -aG opendkim postfix 2>/dev/null || true

# Restart and enable
sudo systemctl restart opendkim
sudo systemctl enable opendkim
echo "OpenDKIM installed and running"
