#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

sudo cp -r "$ROOT_DIR/share/skel/public_html" /etc/skel
echo "Skel template installed to /etc/skel/public_html"
