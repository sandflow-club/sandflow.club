#!/usr/bin/env bash
set -euo pipefail

# Linux Chrome/Chromium uses an NSS user database in addition to OS trust.
# Only synchronize the Portless CA; never disable browser TLS verification.
dev_portless_browser_trust() {
  [[ "$(uname -s)" == Linux && "${PORTLESS_HTTPS:-1}" != 0 ]] || return 0
  local browser_home="${1:-$HOME}"
  local ca="${PORTLESS_STATE_DIR:-$HOME/.portless}/ca.pem"
  [[ -f "$ca" ]] || return 0
  local database tool nickname='Portless local development CA' fingerprint installed
  local -a databases=()
  for database in "$browser_home/.pki/nssdb" "$browser_home/.local/share/pki/nssdb"; do
    [[ ! -f "$database/cert9.db" ]] || databases+=("$database")
  done
  [[ ${#databases[@]} -gt 0 ]] || return 0
  tool="$(command -v certutil || true)"
  if [[ -z "$tool" && -x "$browser_home/.local/bin/certutil" ]]; then
    tool="$browser_home/.local/bin/certutil"
  fi
  if [[ -z "$tool" ]]; then
    printf '%s\n' \
      'dev: Chrome certificate database found, but certutil is missing.' \
      'Install libnss3-tools (Debian/Ubuntu: sudo apt install libnss3-tools), then run make dev-trust.' >&2
    return 1
  fi
  fingerprint="$(openssl x509 -in "$ca" -noout -fingerprint -sha256)" || return "$?"
  for database in "${databases[@]}"; do
    installed="$("$tool" -L -d "sql:$database" -n "$nickname" -a 2>/dev/null |
      openssl x509 -noout -fingerprint -sha256 2>/dev/null)" || installed=''
    if [[ "$installed" == "$fingerprint" ]] &&
      "$tool" -V -d "sql:$database" -n "$nickname" -u L >/dev/null 2>&1; then
      continue
    fi
    if [[ -n "$installed" && "$installed" != "$fingerprint" ]]; then
      "$tool" -D -d "sql:$database" -n "$nickname" || return "$?"
    fi
    "$tool" -A -d "sql:$database" -n "$nickname" -t 'C,,' -i "$ca" || return "$?"
    "$tool" -V -d "sql:$database" -n "$nickname" -u L >/dev/null || return "$?"
    printf 'dev: Portless CA trusted in %s. Restart Chrome if it is already open.\n' "$database"
  done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  dev_portless_browser_trust "$@"
fi
