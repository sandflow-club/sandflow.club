#!/bin/bash
set -euo pipefail

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

sudo certbot --nginx -d sandflow.club -d www.sandflow.club --cert-name sandflow.club

sudo nginx -s reload
