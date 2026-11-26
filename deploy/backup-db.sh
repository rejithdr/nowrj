#!/usr/bin/env bash
# Dumps the nowrj database to ~/backups (kept 14 days) and, once S3 is set up,
# copies the dump to the private S3 bucket. See deploy/BACKUPS.md.
set -euo pipefail
# Dumps hold the whole database: readable by the ubuntu user only.
umask 077
# The trailing slash matters: after move-db-to-disk.sh, ~/backups is a link
# to the encrypted disk, and find only looks inside a link given as "dir/".
DIR="$HOME/backups/"
mkdir -p "$DIR"
chmod 700 "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
FILE="${DIR}nowrj-$STAMP.dump"
set -a; . /srv/nowrj/backend/.env; set +a
# Sign-in sessions are not backed up: a restore must not sign anyone back in.
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_NAME" -F c --exclude-table-data=user_sessions -f "$FILE"
chmod 600 "$FILE"
find "$DIR" -name 'nowrj-*.dump' -mtime +14 -delete
echo "$(date) backup ok: $(basename "$FILE")"

# Off-server copy. The bucket name lives in ~/.nowrj-backup and the access key
# in ~/.aws/credentials (profile nowrj-backup); neither is in GitHub.
CONF="$HOME/.nowrj-backup"
if [ -f "$CONF" ]; then
  . "$CONF"
  AWS=$(command -v aws || echo /snap/bin/aws)
  if "$AWS" s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/daily/$(basename "$FILE")" \
      --sse AES256 --profile nowrj-backup --region ap-south-1 --only-show-errors; then
    echo "$(date) copied to S3: s3://${BACKUP_S3_BUCKET}/daily/$(basename "$FILE")"
    # The list of deleted accounts (ids only) must outlive the server too, so a
    # restore can delete them again (deploy/BACKUPS.md, "Restoring for real").
    if [ -f /srv/nowrj/erasures.log ]; then
      "$AWS" s3 cp /srv/nowrj/erasures.log "s3://${BACKUP_S3_BUCKET}/erasures.log" \
        --sse AES256 --profile nowrj-backup --region ap-south-1 --only-show-errors || true
    fi
  else
    echo "$(date) S3 COPY FAILED for $(basename "$FILE"); the local copy is in $DIR" >&2
    exit 2
  fi
else
  echo "$(date) S3 copy skipped: $CONF not found (see deploy/BACKUPS.md)"
fi

# Heartbeat for the health check (GET /api/health): it reports a problem when
# this file is more than 26 hours old, so a failed or missed backup is noticed.
date -Is > /srv/nowrj/last-backup-ok 2>/dev/null || true
