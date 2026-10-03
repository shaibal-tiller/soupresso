# Database backup and restore

**What:** every Saturday 10:00 AM (Dhaka) a GitHub Action (`.github/workflows/db-backup.yml`) runs `pg_dump` on the
Neon database, checks it, encrypts it (AES-256) and keeps it as a GitHub artifact for 9 days. GitHub deletes the older
one on its own, so there are never more than two. It can also be run any time: GitHub → **Actions** →
**Weekly database backup** → **Run workflow**.

**Secrets it needs** (GitHub → Settings → Secrets and variables → Actions):
- `DATABASE_URL_UNPOOLED` — Neon connection string with the **direct** host (no `-pooler`).
- `BACKUP_PASSPHRASE` — the passphrase used to encrypt. Keep a copy somewhere safe outside GitHub; without it a backup cannot be opened.

## The easy way (download the folder, run one file)
The Google Drive folder **Soupresso-Backups** is self-contained:
`soupresso-latest.dump.gpg` (the backup, replaced every Saturday), `restore.config` (the passphrase, plain text, private Drive) and `restore-backup.sh`.
1. Download the whole folder from Drive and open Terminal in it (`cd` to the folder).
2. Create a **new empty** Neon database (or project) and have its connection string ready (a branch copies its parent's data, so it isn't empty).
3. Run `bash restore-backup.sh`. It finds the backup, decrypts it with the passphrase from `restore.config`, checks it, asks for the
   connection string, and restores. (`bash restore-backup.sh check` only verifies, restoring nothing.)

It refuses any database that already has tables, so it can't overwrite your live database. It offers to install `gnupg` and
`postgresql@18` with Homebrew if they're missing. The same script lives in this repo as `scripts/restore-backup.sh`.

## The manual way
### Get a backup
1. GitHub → **Actions** → pick a green "Weekly database backup" run → download **soupresso-db-backup** (a zip) from *Artifacts*.
2. Unzip it. You get `soupresso-backup-YYYY-MM-DD.dump.gpg`.
3. Decrypt (asks for the passphrase):
   ```
   gpg --output backup.dump --decrypt soupresso-backup-YYYY-MM-DD.dump.gpg
   ```
   Once a month, also copy one of these files to your computer or a drive — artifacts live only on GitHub.

## Restore
Never restore straight over the live database. Restore into a **new empty** Neon database or project first (not a branch — a branch is a copy of its parent), check it, then switch.
1. In Neon, create a new empty database (or project) and copy its connection string (direct host, pooling off).
2. Load the backup (needs the PostgreSQL 18 client tools — Neon runs 18):
   ```
   pg_restore --no-owner --no-privileges --dbname "<new connection string>" backup.dump
   ```
3. Look at the data (recent daily entries, cash in hand balance).
4. Point the app at it by changing `DATABASE_URL` in Vercel → Settings → Environment Variables, then redeploy.

## Notes
- GitHub pauses scheduled workflows after ~60 days with no repository activity. If a Saturday backup is missing, open the Actions tab and click **Run workflow** (that re-enables the schedule).
- GitHub emails you when a scheduled run fails.
- The old `backup_db.js` (JSON rows, run by hand) still works but has no schema; prefer this.
