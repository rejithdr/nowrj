#!/usr/bin/env bash
# Dumps the nowrj database to ~/backups and keeps the last 14 days.
set -euo pipefail
DIR="$HOME/backups"
mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
set -a; . /srv/nowrj/backend/.env; set +a
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_NAME" -F c -f "$DIR/nowrj-$STAMP.dump"
find "$DIR" -name 'nowrj-*.dump' -mtime +14 -delete
echo "$(date) backup ok: nowrj-$STAMP.dump"
