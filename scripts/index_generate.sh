#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source configuration
source "$ROOT_DIR/config.env"

# List only user directories (not loose files like id_rsa.pub)
export index_users=$(ls -d "$ROOT_DIR/users"/*/ 2>/dev/null | xargs -n1 basename | awk -v domain="$DOMAIN" '{printf("<a href=\"https://%s/~%s\">~%s</a>\n", domain, $1, $1)}')
export readme=$(cat "$ROOT_DIR/README")

# Create dist directory if it doesn't exist
mkdir -p "$ROOT_DIR/dist"

# Generate HTML from template
envsubst < "$ROOT_DIR/share/templates/index.html.tmpl" > "$ROOT_DIR/dist/index.html"

# Copy static assets if they exist
if [ -f "$ROOT_DIR/share/favicon.ico" ]; then
    cp "$ROOT_DIR/share/favicon.ico" "$ROOT_DIR/dist/"
fi

echo "Index generated to $ROOT_DIR/dist/"
