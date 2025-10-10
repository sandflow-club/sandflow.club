#!/bin/bash

NEW_USER=$1
PUB_KEY_FILE=$2

# create user
adduser --disabled-password --gecos "" $NEW_USER
cat $PUB_KEY_FILE > /home/$NEW_USER/.ssh/authorized_keys
chown -R $NEW_USER:$NEW_USER /home/$NEW_USER/.ssh
chmod 700 /home/$NEW_USER/.ssh
chmod 600 /home/$NEW_USER/.ssh/authorized_keys

# generate index.html
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
export index_users=`ls "$ROOT_DIR/users" | tr -s '' | awk '{printf("<a href=\"https://sandflow.club/~%s\">~%s</a>\n", $1, $1)}'`
envsubst < "$SCRIPT_DIR/index.html.tmpl" > "$ROOT_DIR/index.html"
