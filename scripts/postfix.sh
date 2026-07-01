#!/bin/bash
set -euo pipefail

# Non-interactive install to avoid config prompts hanging the script
export DEBIAN_FRONTEND=noninteractive
sudo apt update
sudo apt install -y postfix
sudo postconf home_mailbox=Maildir/
sudo systemctl restart postfix
echo "Postfix installed and configured with Maildir/"
