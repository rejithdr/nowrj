#!/usr/bin/env bash
# Makes sure backend/.env has DATA_ENCRYPTION_KEY, the key that encrypts
# advertiser phone numbers, consent scans and GSTINs in the database.
# Creates one the first time; never changes an existing key.
# Run by update.sh and setup-server.sh. Safe to run again.
set -euo pipefail
ENV_FILE="${1:-/srv/nowrj/backend/.env}"
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE yet; skipping the data key."; exit 0; }
if grep -qE '^DATA_ENCRYPTION_KEY=.{40,}' "$ENV_FILE"; then
  exit 0
fi
sed -i '/^DATA_ENCRYPTION_KEY=/d' "$ENV_FILE"
{
  echo ""
  echo "# Encrypts sensitive fields. Keep a copy OFF this server (password manager)."
  echo "# Without it, those fields cannot be read, even from a backup. Never change it."
  echo "DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)"
} >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
cat <<MSG

************************************************************************
  A new data encryption key was created in $ENV_FILE
  Save a copy of it NOW in a password manager (not in GitHub, not in S3).
  To see it:   grep DATA_ENCRYPTION_KEY $ENV_FILE
  Without it, phone numbers, consent scans and GSTINs in any backup
  cannot be read.
************************************************************************

MSG
