#!/bin/bash
set -euo pipefail

nginx_conf="/etc/nginx/sites-available/default"

user_homepage_location='

    	location ~ ^/~(.+?)(/.*)?$ {
        	alias /home/$1/public_html$2;
        	index index.html index.htm;
        	autoindex on;
    	}
'

if [ ! -f "$nginx_conf" ]; then
    echo "Error: Nginx config file not found at $nginx_conf"
    exit 1
fi

# Check if user homepage location is already configured (idempotent)
if grep -q 'location ~ \^/~' "$nginx_conf"; then
    echo "User homepage location already configured in nginx, skipping."
    exit 0
fi

# Insert the location block after the first server block's root location
escaped_user_homepage_location=$(printf '%s\n' "$user_homepage_location" | sed -e 's/[]\/$*.^[]/\\&/g')
matched=0
sudo perl -0777 -i -pe "if (\$matched == 0 && s/(location\s*\/\s*{\s*[^}]*\s*})/\$1$escaped_user_homepage_location/) { \$matched = 1; }" "$nginx_conf"

# Test and reload nginx
sudo nginx -t && sudo nginx -s reload
echo "Nginx config updated and reloaded"
