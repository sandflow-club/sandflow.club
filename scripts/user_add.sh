#!/bin/bash
set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <pub_key_file>"
    exit 1
fi

NEW_USER=$1
PUB_KEY_FILE=$2

if [ ! -f "$PUB_KEY_FILE" ]; then
    echo "Error: public key file '$PUB_KEY_FILE' not found"
    exit 1
fi

# Get script/root directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Create user
sudo adduser --disabled-password --gecos "" "$NEW_USER"

# Set up SSH authorized keys
sudo mkdir -p /home/$NEW_USER/.ssh
cat "$PUB_KEY_FILE" | sudo tee /home/$NEW_USER/.ssh/authorized_keys > /dev/null
sudo chown -R $NEW_USER:$NEW_USER /home/$NEW_USER/.ssh
sudo chmod 700 /home/$NEW_USER/.ssh
sudo chmod 600 /home/$NEW_USER/.ssh/authorized_keys

echo "User $NEW_USER created successfully"

# Regenerate and deploy index page
"$SCRIPT_DIR/index_generate.sh"
"$SCRIPT_DIR/index_deploy.sh"
echo "Index page regenerated and deployed"
