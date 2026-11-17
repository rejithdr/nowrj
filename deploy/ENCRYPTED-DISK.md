# Encryption at rest

Two layers protect stored data:

1. **Encrypted disk.** The database and local backups live on an attached
   Lightsail disk, which AWS encrypts at rest. Off-server backups in S3 are
   encrypted too (`backup-db.sh` uploads with AES-256).
2. **Encrypted fields.** Advertiser phone numbers, signed consent scans and
   GSTINs are also encrypted inside the database with `DATA_ENCRYPTION_KEY`
   (`backend/.env`, created by `ensure-data-key.sh`). Keep a copy of that key
   in a password manager. Without it those fields cannot be read, even from a
   backup.

## Moving the database onto an encrypted disk (once, about 15 minutes)

1. **Snapshot first.** Lightsail → your instance → *Snapshots* → *Create
   snapshot*. Wait until it says it's ready. That is your undo.
2. **Create the disk.** Lightsail → *Storage* → *Create disk*. Same region and
   **same zone** as the instance (Mumbai, the zone shown on the instance),
   20 GB, name it `nowrj-data`.
3. **Attach it.** Open the disk → *Attach* → choose the nowrj instance.
4. **Move.** In the server terminal (type it, don't paste):

       bash /srv/nowrj/deploy/move-db-to-disk.sh

   It finds the new empty disk, asks you to type `yes`, takes a backup,
   copies the database, checks the row counts match and starts the site
   again. If anything does not match it puts the old copy back.
5. **Check and reboot.** Open the site and sign in. Then `sudo reboot`, wait
   a minute, and check the site again.
6. **Delete the old copy** on the system disk:

       bash /srv/nowrj/deploy/move-db-to-disk.sh --cleanup

7. When all is well for a few days, delete the snapshot from step 1 (it holds
   an unencrypted copy).
