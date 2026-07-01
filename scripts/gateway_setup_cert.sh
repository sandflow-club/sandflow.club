#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source configuration
source "$ROOT_DIR/config.env"

# Install nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

sudo apt update
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core

sudo snap install --classic certbot

sudo ln -sf /snap/bin/certbot /usr/bin/certbot

sudo certbot --nginx \
    --non-interactive --agree-tos \
    --email "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --cert-name "$DOMAIN"

sudo nginx -s reload
