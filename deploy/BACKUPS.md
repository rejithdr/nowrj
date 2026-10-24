# Off-server backups in AWS S3

Every night at 02:30 (India time) the server dumps the database to `~/backups`
(kept 14 days). Once the steps below are done, each dump is also copied to a
private, encrypted S3 bucket in Mumbai, where S3 deletes copies older than 14 days.

Nothing secret goes into GitHub: the access key lives only in
`/home/ubuntu/.aws/credentials` and the bucket name in `/home/ubuntu/.nowrj-backup`.

## 1. Create the bucket (AWS console → S3)

1. **Create bucket**.
   - Region: **Asia Pacific (Mumbai) ap-south-1**
   - Name: something unique, e.g. `nowrj-backups-7k3q` (letters, digits, dashes). Note it.
   - **Block all public access**: leave ON (the default).
   - Bucket versioning: Disable.
   - Default encryption: **SSE-S3** (the default). Bucket key: Enable.
   - Create.
2. Open the bucket → **Management** → **Create lifecycle rule**.
   - Name: `delete-after-14-days`
   - Scope: **Limit the scope** → Prefix: `daily/`
   - Actions: tick **Expire current versions of objects**
   - Days after object creation: **14**
   - Create rule.

## 2. Create a key that can only write and read backups (AWS console → IAM)

1. **Users** → **Create user** → name `nowrj-backup`. Do **not** give console access. Next.
2. Permissions: **Attach policies directly** → don't tick any → Next → Create user.
3. Open the user → **Permissions** → **Add permissions** → **Create inline policy** → **JSON**,
   paste this with your bucket name in both places:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::YOUR-BUCKET" },
       { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::YOUR-BUCKET/daily/*" }
     ]
   }
   ```

   Name it `nowrj-backup-only` → Create policy.
   This key cannot delete backups or touch anything else in your AWS account.
4. **Security credentials** → **Create access key** → use case **Application running outside AWS** → Create.
   Copy the **Access key** and **Secret access key**. The secret is shown only once.
   Do not email it, put it in WhatsApp or save it in the NowRJ folder.

## 3. Put the key on the server (Lightsail terminal)

```
sudo snap install aws-cli --classic
aws configure --profile nowrj-backup
```

Answer the four questions: Access key, Secret access key, region `ap-south-1`, output `json`.
This writes `/home/ubuntu/.aws/credentials`, readable only by the `ubuntu` user.

Then save the bucket name (use yours):

```
echo "BACKUP_S3_BUCKET=nowrj-backups-7k3q" > ~/.nowrj-backup
chmod 600 ~/.nowrj-backup ~/.aws/credentials
```

## 4. Check it works

```
bash /srv/nowrj/deploy/backup-db.sh
```

The last line should read `copied to S3: s3://…/daily/nowrj-….dump`.
The file also appears in the S3 console under the bucket's `daily/` folder.
From now on the nightly backup and every `update.sh` run copy to S3 too
(`~/backups/backup.log` records each night's result).

## 5. Test a restore (safe: never touches the live database)

```
bash /srv/nowrj/deploy/restore-test.sh
```

It downloads the newest backup from S3, restores it into a temporary database,
prints row counts next to the live database's, and deletes the temporary database.
"Restore test passed" means the backup is usable. Do this once now and then once a month.
To test a particular day: `bash /srv/nowrj/deploy/restore-test.sh nowrj-2026-10-25_0230.dump`.

## Restoring for real (only if the live data is lost or damaged)

```
pm2 stop nowrj-backend
. ~/.nowrj-backup
aws s3 cp "s3://$BACKUP_S3_BUCKET/daily/<file>.dump" ~/restore.dump --profile nowrj-backup
set -a; . /srv/nowrj/backend/.env; set +a
PGPASSWORD="$DB_PASSWORD" pg_restore --clean --if-exists -h localhost -U nowrj_app -d nowrj ~/restore.dump
pm2 start nowrj-backend
```

## If the key is ever exposed

IAM → Users → `nowrj-backup` → Security credentials → **Deactivate** and **Delete** the old key,
create a new one, and run `aws configure --profile nowrj-backup` again on the server.
