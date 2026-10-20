#!/usr/bin/env bash
# Deploys the latest code from GitHub: backup, install, build, migrate, restart.
# Run on the server:   bash /srv/nowrj/deploy/update.sh
set -euo pipefail
APP_DIR=/srv/nowrj
cd "$APP_DIR"

echo "==> Backup before changing anything"
bash "$APP_DIR/deploy/backup-db.sh"

echo "==> Latest code"
git pull --ff-only

echo "==> Backend: install, build, migrate"
cd "$APP_DIR/backend"
npm ci
npm run build
npx typeorm migration:run -d dist/data-source.js

echo "==> Website: install and build"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Restart"
cd "$APP_DIR"
pm2 startOrReload deploy/ecosystem.config.js --env production
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
echo "Done. Check: pm2 status"
