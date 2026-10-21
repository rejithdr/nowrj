#!/usr/bin/env bash
# Sends visitors on www.<domain> to <domain>, so everyone uses one address
# (sign-in and the backend only work on the main address).
# Run once on the server after HTTPS is set up:   bash /srv/nowrj/deploy/redirect-www.sh
set -euo pipefail
CONF=/etc/nginx/sites-available/nowrj
if grep -q NOWRJ_WWW_REDIRECT "$CONF"; then
  echo "The www redirect is already on."
  exit 0
fi
DOMAIN=$(grep -m1 -oP 'server_name\s+\K[^ ;]+' "$CONF")
DOMAIN=${DOMAIN#www.}
sudo cp "$CONF" "$CONF.bak"
sudo sed -i "/server_name .*${DOMAIN}/a\\    if (\$host = www.${DOMAIN}) { return 301 https://${DOMAIN}\$request_uri; } # NOWRJ_WWW_REDIRECT" "$CONF"
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "Done: www.${DOMAIN} now forwards to ${DOMAIN}."
else
  sudo cp "$CONF.bak" "$CONF"
  echo "nginx rejected the change; the previous settings were restored."
  exit 1
fi
