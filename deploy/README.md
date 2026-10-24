# Putting NowRJ online (AWS Lightsail, Mumbai)

One small server runs everything: the website, the backend and the database.
The domain stays at GoDaddy; only its DNS records point to the server.

    https://<your-domain>/       -> website (Next.js, port 3001)
    https://<your-domain>/api/   -> backend (NestJS, port 3000)

Replace `<your-domain>` below with the real domain, e.g. `nowrj.com`.

## 1. Create the server (AWS console, ~10 minutes)

1. Open **Lightsail** in the AWS console and click **Create instance**.
2. Region: **Mumbai (ap-south-1)**.
3. Platform **Linux/Unix**, blueprint **OS Only -> Ubuntu 24.04 LTS**.
4. Plan: **$12/month (2 GB RAM, 2 vCPUs, 60 GB SSD)**. Name it `nowrj`. Create.
5. Open the instance -> **Networking** tab:
   - **Create static IP** and attach it to `nowrj`. Note the IP address.
   - Under **IPv4 Firewall**, make sure **SSH (22)**, **HTTP (80)** and **HTTPS (443)** are allowed.
6. Optional but recommended: **Snapshots** tab -> turn on **Automatic snapshots** (daily copy of the whole server, a few dollars a month).

## 2. Point the domain to the server (GoDaddy)

GoDaddy -> My Products -> the domain -> **DNS** -> Manage DNS:

| Type | Name | Value                  | TTL     |
|------|------|------------------------|---------|
| A    | @    | the Lightsail static IP | 600 sec |
| A    | www  | the Lightsail static IP | 600 sec |

Delete any existing `A @` "Parked" record, and any `CNAME www` record, first.
DNS usually takes 10–60 minutes. Check with `nslookup <your-domain>` until it shows the static IP.

## 3. Tell Google about the new address

Google Cloud console -> APIs & Services -> **Credentials** -> the NowRJ OAuth client:

- **Authorized JavaScript origins**: add `https://<your-domain>`
- **Authorized redirect URIs**: add `https://<your-domain>/api/auth/google/callback`

Keep the `localhost` entries so local development still works.
If the OAuth consent screen is still in **Testing**, only listed test users can sign in;
click **Publish app** when you are ready for the public.

## 4. Set up the server (once)

In Lightsail, click **Connect using SSH** (opens a terminal in the browser). Then:

    curl -fsSL https://raw.githubusercontent.com/rejithdr/nowrj/main/deploy/setup-server.sh -o setup-server.sh
    bash setup-server.sh <your-domain> <your-email>

This installs Node, PostgreSQL, nginx and pm2, creates the database with a random password,
downloads the code to `/srv/nowrj`, writes the settings files, turns on HTTPS and
schedules a nightly database backup. Wait for DNS (step 2) before running it, otherwise
HTTPS is skipped; the script then prints the command to add it later.

Now add the secret values:

    nano /srv/nowrj/backend/.env

Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (same as your local `.env`) and
`SUPERADMIN_EMAILS` (your Gmail). Save with Ctrl+O, Enter, Ctrl+X.

## 5. Start NowRJ

    bash /srv/nowrj/deploy/update.sh

The first run takes about 5–10 minutes. Then open `https://<your-domain>` and sign in.
The database starts empty: register as an RJ again and verify yourself from Admin -> RJs.

## Updating after new changes

On your PC: commit and `git push`. Then in the server terminal:

    bash /srv/nowrj/deploy/update.sh

It backs up the database, pulls the code, runs any new migrations and restarts.

## Useful commands

    pm2 status                     # are both apps running?
    pm2 logs nowrj-backend         # backend errors (Ctrl+C to exit)
    pm2 logs nowrj-web             # website errors
    pm2 restart all                # restart both
    ls ~/backups                   # nightly database backups (last 14 days)
    bash /srv/nowrj/deploy/restore-test.sh   # prove the newest S3 backup restores (see BACKUPS.md)
    sudo certbot renew --dry-run   # check HTTPS auto-renewal

Off-server copies in AWS S3: see **BACKUPS.md**.

## Restoring a backup

    pm2 stop nowrj-backend
    set -a; . /srv/nowrj/backend/.env; set +a
    PGPASSWORD="$DB_PASSWORD" pg_restore --clean --if-exists -h localhost -U nowrj_app -d nowrj ~/backups/<file>.dump
    pm2 start nowrj-backend
