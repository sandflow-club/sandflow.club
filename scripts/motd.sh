#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Install dynamic MOTD script to update-motd.d (executed on login)
sudo cp "$ROOT_DIR/share/config/motd" /etc/update-motd.d/99-sandflow
sudo chmod +x /etc/update-motd.d/99-sandflow
echo "MOTD installed to /etc/update-motd.d/99-sandflow"
