#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

CONFIG_DIR="$ROOT_DIR/share/config/dovecot"
DOVECOT_BASE="/etc/dovecot"

if [ ! -d "$CONFIG_DIR" ]; then
    echo "Error: Dovecot config directory not found at $CONFIG_DIR"
    exit 1
fi

# Non-interactive install
export DEBIAN_FRONTEND=noninteractive
sudo apt update
sudo apt install -y dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-sieve dovecot-managesieved

# Backup existing config if present
if [ -f "$DOVECOT_BASE/dovecot.conf" ]; then
    BACKUP_DIR="$DOVECOT_BASE.bak.$(date +%Y%m%d_%H%M%S)"
    sudo cp -r "$DOVECOT_BASE" "$BACKUP_DIR"
    echo "Backed up existing dovecot config to $BACKUP_DIR"
fi

# Deploy dovecot configuration
sudo cp "$CONFIG_DIR/dovecot.conf" "$DOVECOT_BASE/dovecot.conf"
sudo cp "$CONFIG_DIR/conf.d/"*.conf "$DOVECOT_BASE/conf.d/"

# Ensure correct permissions
sudo chown -R root:root "$DOVECOT_BASE"
sudo chmod 644 "$DOVECOT_BASE/dovecot.conf"
sudo chmod 644 "$DOVECOT_BASE/conf.d/"*.conf

# Start and enable dovecot
sudo systemctl restart dovecot
sudo systemctl enable dovecot
echo "Dovecot installed and configured"
