#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export index_users=`ls "$ROOT_DIR/users" | tr -s '' | awk '{printf("<a href=\"https://sandflow.club/~%s\">~%s</a>\n", $1, $1)}'`
export readme=$(cat "$ROOT_DIR/README")
envsubst < "$ROOT_DIR/share/templates/index.html.tmpl" > "$ROOT_DIR/index.html"
