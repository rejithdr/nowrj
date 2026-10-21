#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server (AWS Lightsail) for NowRJ.
# Run as the default "ubuntu" user:   bash setup-server.sh nowrj.com you@example.com
set -euo pipefail

DOMAIN="${1:?Usage: bash setup-server.sh <domain> <email for HTTPS certificate>}"
EMAIL="${2:?Usage: bash setup-server.sh <domain> <email for HTTPS certificate>}"
APP_DIR=/srv/nowrj
REPO=https://github.com/rejithdr/nowrj.git

echo "==> 1/8 System packages"
sudo apt-get -o DPkg::Lock::Timeout=900 update -y
sudo apt-get -o DPkg::Lock::Timeout=900 install -y git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw

# Run everything on India time, like the development machine.
sudo timedatectl set-timezone Asia/Kolkata

echo "==> 2/8 Node.js 24 and pm2"
if ! command -v node >/dev/null || ! node -v | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

echo "==> 3/8 Swap (helps the website build on a 2 GB server)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> 4/8 Database"
DB_PASSWORD=$(openssl rand -hex 24)
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='nowrj_app'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER nowrj_app WITH PASSWORD '${DB_PASSWORD}';"
  sudo -u postgres psql -c "CREATE DATABASE nowrj OWNER nowrj_app;"
  sudo -u postgres psql -d nowrj -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
  sudo -u postgres psql -c "ALTER DATABASE nowrj SET timezone TO 'Asia/Kolkata';"
  echo "Database user created."
else
  DB_PASSWORD=""
  echo "Database user already exists; keeping its password."
fi

echo "==> 5/8 Code"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi

echo "==> 6/8 Settings files"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  sed -e "s#__DOMAIN__#${DOMAIN}#g" \
      -e "s#__DB_PASSWORD__#${DB_PASSWORD}#g" \
      -e "s#__SESSION_SECRET__#$(openssl rand -hex 32)#g" \
      "$APP_DIR/deploy/backend.env.example" > "$APP_DIR/backend/.env"
  chmod 600 "$APP_DIR/backend/.env"
  echo "Created backend/.env. You still need to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SUPERADMIN_EMAILS."
fi
if [ ! -f "$APP_DIR/frontend/.env.production" ]; then
  sed -e "s#__DOMAIN__#${DOMAIN}#g" "$APP_DIR/deploy/frontend.env.example" > "$APP_DIR/frontend/.env.production"
fi

echo "==> 7/8 Web server and HTTPS"
sed -e "s#__DOMAIN__#${DOMAIN}#g" "$APP_DIR/deploy/nginx-nowrj.conf" | sudo tee /etc/nginx/sites-available/nowrj >/dev/null
sudo ln -sf /etc/nginx/sites-available/nowrj /etc/nginx/sites-enabled/nowrj
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
# Needs the domain's DNS already pointing at this server.
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "HTTPS certificate not issued yet. Once DNS points here, run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo "==> 8/8 Nightly database backup at 02:30"
mkdir -p "$HOME/backups"
( crontab -l 2>/dev/null | grep -v backup-db.sh || true ; echo "30 2 * * * bash $APP_DIR/deploy/backup-db.sh >> $HOME/backups/backup.log 2>&1" ) | crontab -

echo
echo "Setup finished. Next:"
echo "  1. Edit $APP_DIR/backend/.env and fill in the Google and Super Admin values."
echo "  2. Run:  bash $APP_DIR/deploy/update.sh"
