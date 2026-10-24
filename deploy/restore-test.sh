#!/usr/bin/env bash
# Proves a backup in S3 can be restored, without touching the live database:
# downloads the newest (or a named) dump, restores it into a temporary
# database, compares row counts with the live one, then deletes the copy.
#   bash /srv/nowrj/deploy/restore-test.sh                 # newest backup
#   bash /srv/nowrj/deploy/restore-test.sh nowrj-2026-10-25_0230.dump
set -euo pipefail
. "$HOME/.nowrj-backup"
LIVE_DB=$(grep -E '^DB_NAME=' /srv/nowrj/backend/.env | cut -d= -f2)
AWS=$(command -v aws || echo /snap/bin/aws)
S3="s3://${BACKUP_S3_BUCKET}/daily/"
NAME="${1:-$("$AWS" s3 ls "$S3" --profile nowrj-backup --region ap-south-1 | awk '{print $4}' | sort | tail -1)}"
[ -n "$NAME" ] || { echo "No backups found in $S3"; exit 1; }

WORK=$(mktemp -d)
TEST_DB=nowrj_restore_test
cleanup() {
  rm -rf "$WORK"
  sudo -u postgres dropdb --if-exists "$TEST_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Downloading $NAME"
"$AWS" s3 cp "$S3$NAME" "$WORK/$NAME" --profile nowrj-backup --region ap-south-1 --only-show-errors
chmod 644 "$WORK/$NAME"; chmod 755 "$WORK"

echo "==> Restoring into the temporary database $TEST_DB"
sudo -u postgres dropdb --if-exists "$TEST_DB"
sudo -u postgres createdb "$TEST_DB"
sudo -u postgres psql -q -d "$TEST_DB" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
sudo -u postgres pg_restore --no-owner --no-privileges -d "$TEST_DB" "$WORK/$NAME"

echo "==> Row counts: backup vs live now"
for t in listeners rjs stations programmes show_occurrences reactions song_requests engagement_events follows; do
  b=$(sudo -u postgres psql -At -d "$TEST_DB" -c "SELECT count(*) FROM $t")
  l=$(sudo -u postgres psql -At -d "$LIVE_DB" -c "SELECT count(*) FROM $t")
  printf '  %-20s backup %-8s live %s\n' "$t" "$b" "$l"
done
echo "Restore test passed: $NAME restores cleanly. The temporary database is removed now."
