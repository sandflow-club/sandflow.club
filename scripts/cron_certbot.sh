#!/bin/bash
set -euo pipefail

# Define the cron schedule for every Monday at midnight
cron_schedule="0 0 * * 1"

command="certbot renew --post-hook 'systemctl reload nginx'"

# Append to crontab without overwriting existing entries (also avoid duplicates)
(crontab -l 2>/dev/null | grep -v 'certbot renew'; echo "$cron_schedule $command") | crontab -
echo "Certbot cron job added to crontab"
