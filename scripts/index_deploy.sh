#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -d "$ROOT_DIR/dist" ]; then
    echo "Error: dist/ directory not found. Run index_generate.sh first."
    exit 1
fi

# Deploy all files from dist directory to web root
sudo cp -r "$ROOT_DIR/dist/"* /var/www/html/
echo "Deployed to /var/www/html/"
