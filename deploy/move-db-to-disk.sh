#!/usr/bin/env bash
# Moves the PostgreSQL data, and the local backups, onto an attached
# Lightsail disk, which AWS encrypts at rest. Steps and checks:
# deploy/ENCRYPTED-DISK.md.
#
#   bash /srv/nowrj/deploy/move-db-to-disk.sh            # do the move
#   bash /srv/nowrj/deploy/move-db-to-disk.sh --cleanup  # later: delete the old copy
#
# The website is down for a few minutes while the data is copied.
set -euo pipefail
MNT=/mnt/nowrjdata
PGDIR=/var/lib/postgresql
OLD=/var/lib/postgresql.before-move
APP_DIR=/srv/nowrj
DB_NAME=$(grep -E '^DB_NAME=' "$APP_DIR/backend/.env" | cut -d= -f2)

say() { printf '\n==> %s\n' "$*"; }
count() { sudo -u postgres psql -d "$DB_NAME" -Atqc "SELECT (SELECT count(*) FROM listeners)||'/'||(SELECT count(*) FROM programmes)||'/'||(SELECT count(*) FROM show_occurrences)"; }

if [ "${1:-}" = "--cleanup" ]; then
  mountpoint -q "$PGDIR" || { echo "The database is not on the attached disk; nothing to clean up."; exit 1; }
  [ -d "$OLD" ] || { echo "No old copy at $OLD; already cleaned up."; exit 0; }
  say "Deleting the old copy on the system disk ($OLD)"
  sudo rm -rf "$OLD"
  [ -d "$HOME/backups.before-move" ] && rm -rf "$HOME/backups.before-move"
  echo "Done. The data now lives only on the encrypted disk."
  exit 0
fi

if mountpoint -q "$PGDIR"; then
  echo "The database is already on the attached disk ($MNT)."; exit 0
fi

say "Looking for the new, empty attached disk"
ROOT_DISK=$(lsblk -no PKNAME "$(findmnt -no SOURCE /)" | head -1)
DEV=""
for d in $(lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}'); do
  [ "$(basename "$d")" = "$ROOT_DISK" ] && continue
  [ -n "$(lsblk -no NAME "$d" | sed 1d)" ] && continue          # has partitions
  [ -n "$(sudo blkid -o value -s TYPE "$d" 2>/dev/null)" ] && continue  # already formatted
  [ -n "$DEV" ] && { echo "More than one empty disk found ($DEV and $d). Attach only one."; exit 1; }
  DEV=$d
done
[ -n "$DEV" ] || { echo "No empty attached disk found. Create and attach one in Lightsail first (deploy/ENCRYPTED-DISK.md)."; exit 1; }
SIZE_GB=$(( $(lsblk -bdno SIZE "$DEV") / 1024 / 1024 / 1024 ))
USED_GB=$(( $(sudo du -sb "$PGDIR" | cut -f1) / 1024 / 1024 / 1024 + 1 ))
echo "Found $DEV ($SIZE_GB GB). The database uses about $USED_GB GB."
[ "$SIZE_GB" -ge $(( USED_GB * 3 )) ] || { echo "That disk is too small; use at least $(( USED_GB * 3 )) GB."; exit 1; }
read -r -p "Format $DEV and move the database onto it? Type yes: " answer
[ "$answer" = "yes" ] || { echo "Stopped; nothing changed."; exit 1; }

say "Backup first"
bash "$APP_DIR/deploy/backup-db.sh" || [ $? = 2 ]
BEFORE=$(count)
echo "Rows before (listeners/programmes/shows): $BEFORE"

say "Formatting and mounting the disk at $MNT"
sudo mkfs.ext4 -q -L nowrjdata "$DEV"
sudo mkdir -p "$MNT"
grep -q 'LABEL=nowrjdata' /etc/fstab || echo "LABEL=nowrjdata $MNT ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab >/dev/null
sudo mount "$MNT"

say "Stopping the website and the database"
pm2 stop all >/dev/null
sudo systemctl stop postgresql

say "Copying the database"
sudo rsync -aHAX "$PGDIR/" "$MNT/postgresql/"
sudo mv "$PGDIR" "$OLD"
sudo mkdir "$PGDIR"
sudo chown postgres:postgres "$PGDIR"
grep -q "$MNT/postgresql $PGDIR" /etc/fstab || \
  echo "$MNT/postgresql $PGDIR none bind,nofail,x-systemd.requires-mounts-for=$MNT 0 0" | sudo tee -a /etc/fstab >/dev/null
sudo mount "$PGDIR"
# Never let PostgreSQL start on an empty folder if the disk is missing.
for unit in postgresql.service postgresql@.service; do
  sudo mkdir -p "/etc/systemd/system/$unit.d"
  printf '[Unit]\nRequiresMountsFor=%s\n' "$PGDIR" | sudo tee "/etc/systemd/system/$unit.d/nowrj-disk.conf" >/dev/null
done
sudo systemctl daemon-reload

say "Starting the database again"
sudo systemctl start postgresql
sleep 3
AFTER=$(count)
echo "Rows after (listeners/programmes/shows): $AFTER"
if [ "$AFTER" != "$BEFORE" ]; then
  echo "Row counts differ! Putting the old copy back."
  sudo systemctl stop postgresql
  sudo umount "$PGDIR"; sudo rmdir "$PGDIR"; sudo mv "$OLD" "$PGDIR"
  sudo sed -i "\#$MNT/postgresql $PGDIR#d" /etc/fstab
  sudo rm -f /etc/systemd/system/postgresql.service.d/nowrj-disk.conf /etc/systemd/system/postgresql@.service.d/nowrj-disk.conf
  sudo systemctl daemon-reload; sudo systemctl start postgresql; pm2 start all
  exit 1
fi

say "Moving local backups onto the disk"
if [ -d "$HOME/backups" ] && [ ! -L "$HOME/backups" ]; then
  sudo mkdir -p "$MNT/backups"; sudo chown "$USER:$USER" "$MNT/backups"
  cp -a "$HOME/backups/." "$MNT/backups/"
  mv "$HOME/backups" "$HOME/backups.before-move"
  ln -s "$MNT/backups" "$HOME/backups"
fi

say "Starting the website"
pm2 start all >/dev/null
pm2 save >/dev/null
cat <<MSG

Done. The database and local backups are now on the encrypted disk.
Check https://nowrj.com works and you can sign in. Then reboot once to be sure
it all comes back:   sudo reboot
After the reboot, when the site works, delete the old unencrypted copy:
  bash $APP_DIR/deploy/move-db-to-disk.sh --cleanup
MSG
