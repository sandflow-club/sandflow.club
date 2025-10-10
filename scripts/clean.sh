#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Clean the dist directory
rm -rf "$ROOT_DIR/dist"
echo "Cleaned dist directory"
