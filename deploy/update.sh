#!/usr/bin/env bash
# Deploys the latest code from GitHub: backup, install, build, migrate, restart.
# Run on the server:   bash /srv/nowrj/deploy/update.sh
set -euo pipefail
# Everything is inside main() so bash reads the whole script before running it;
# "git pull" below may replace this very file.
main() {
  APP_DIR=/srv/nowrj
  cd "$APP_DIR"

  echo "==> Backup before changing anything"
  status=0
  bash "$APP_DIR/deploy/backup-db.sh" || status=$?
  if [ "$status" = 2 ]; then
    echo "WARNING: the local backup worked but the copy to S3 failed. Continuing; check deploy/BACKUPS.md."
  elif [ "$status" != 0 ]; then
    echo "Backup failed; stopping before any change."; exit 1
  fi

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
}
main "$@"
