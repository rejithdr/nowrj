#!/usr/bin/env bash
# Deploys the latest code from GitHub: backup, install, build, migrate, restart.
# Run on the server:   bash /srv/nowrj/deploy/update.sh
set -euo pipefail
# Everything is inside main() so bash reads the whole script before running it;
# "git pull" below may replace this very file.
# Copies an nginx file into place only if it changed, checks the whole config,
# and puts the old file back if nginx rejects the new one.
install_nginx_conf() {
  local src="$1" dest="$2"
  if sudo cmp -s "$src" "$dest" 2>/dev/null; then return 0; fi
  if [ -f "$dest" ]; then sudo cp "$dest" "$dest.previous"; fi
  sudo cp "$src" "$dest"
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
    echo "Updated $dest"
  else
    echo "WARNING: nginx rejected $dest; putting the previous version back."
    if [ -f "$dest.previous" ]; then sudo mv "$dest.previous" "$dest"; else sudo rm -f "$dest"; fi
    sudo nginx -t && sudo systemctl reload nginx
  fi
}

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

  echo "==> Data encryption key"
  bash "$APP_DIR/deploy/ensure-data-key.sh" "$APP_DIR/backend/.env"

  echo "==> Backend: install and test"
  cd "$APP_DIR/backend"
  npm ci
  # The tests run before anything is built or migrated: if they fail, the
  # site keeps running the previous version untouched.
  if ! npm test --silent; then
    echo "Tests failed: nothing on the live site was changed. Fix the code, push, and run this again."
    exit 1
  fi

  echo "==> Backend: build and migrate"
  npm run build
  npx typeorm migration:run -d dist/data-source.js

  echo "==> Website: install and build"
  cd "$APP_DIR/frontend"
  npm ci
  npm run build

  echo "==> Web server security settings"
  install_nginx_conf "$APP_DIR/deploy/nginx-security.conf" /etc/nginx/conf.d/nowrj-security.conf
  install_nginx_conf "$APP_DIR/deploy/nginx-deny-unknown.conf" /etc/nginx/sites-available/00-deny-unknown
  sudo ln -sf /etc/nginx/sites-available/00-deny-unknown /etc/nginx/sites-enabled/00-deny-unknown

  echo "==> Log rotation"
  # pm2's logs grow forever without this: keep 14 files of at most 10 MB each.
  if ! pm2 describe pm2-logrotate >/dev/null 2>&1; then
    pm2 install pm2-logrotate >/dev/null
    pm2 set pm2-logrotate:max_size 10M >/dev/null
    pm2 set pm2-logrotate:retain 14 >/dev/null
    pm2 set pm2-logrotate:compress true >/dev/null
  fi

  echo "==> Restart"
  cd "$APP_DIR"
  pm2 startOrReload deploy/ecosystem.config.js --env production
  pm2 save
  sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null

  echo "==> Health check"
  for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
      echo "The backend is up and healthy."
      bash "$APP_DIR/deploy/api-smoke.sh" || echo "WARNING: some API checks failed (see above)."
      echo "Done. Check the site in a browser too."
      return 0
    fi
    sleep 2
  done
  echo "WARNING: the backend has not reported healthy after 60 seconds."
  curl -sS http://127.0.0.1:3000/health || true
  echo
  echo "Look at: pm2 logs nowrj-backend --lines 50"
}
main "$@"
