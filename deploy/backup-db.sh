#!/usr/bin/env bash
# Dumps the nowrj database to ~/backups (kept 14 days) and, once S3 is set up,
# copies the dump to the private S3 bucket. See deploy/BACKUPS.md.
set -euo pipefail
DIR="$HOME/backups"
mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
FILE="$DIR/nowrj-$STAMP.dump"
set -a; . /srv/nowrj/backend/.env; set +a
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_NAME" -F c -f "$FILE"
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
  else
    echo "$(date) S3 COPY FAILED for $(basename "$FILE"); the local copy is in $DIR" >&2
    exit 2
  fi
else
  echo "$(date) S3 copy skipped: $CONF not found (see deploy/BACKUPS.md)"
fi
